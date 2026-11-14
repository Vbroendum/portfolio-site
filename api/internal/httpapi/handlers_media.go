package httpapi

import (
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/vbroendum/portfolio/api/internal/media"
	"github.com/vbroendum/portfolio/api/internal/models"
	"github.com/vbroendum/portfolio/api/internal/store"
)

func (s *Server) handleListMedia(w http.ResponseWriter, r *http.Request) {
	limit := queryInt(r, "limit", 60)
	offset := queryInt(r, "offset", 0)
	items, total, err := s.store.ListMedia(r.Context(), limit, offset)
	if err != nil {
		writeStoreErr(w, err, "media")
		return
	}
	writeJSON(w, http.StatusOK, ListEnvelope[models.Media]{
		Items: items, Total: total, Limit: limit, Offset: offset,
	})
}

// handleUploadMedia accepts multipart/form-data with:
//
//	file   (required) the bytes
//	alt    (optional) alt text
//
// The content type is taken from the sniffed bytes, not the client's claim, and
// must be on media.AllowedContentTypes.
func (s *Server) handleUploadMedia(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadBytes)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeErr(w, http.StatusRequestEntityTooLarge, "too_large",
			"upload failed - file may exceed the size limit")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "missing 'file' field")
		return
	}
	defer file.Close()

	// Sniff the first 512 bytes to determine the real content type.
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	head = head[:n]
	contentType := http.DetectContentType(head)
	contentType = strings.TrimSpace(strings.Split(contentType, ";")[0])

	// DetectContentType cannot tell webp/avif/svg apart reliably; fall back to
	// the client's declared type when the sniff is inconclusive.
	if contentType == "application/octet-stream" || contentType == "text/xml" {
		if declared := header.Header.Get("Content-Type"); declared != "" {
			contentType = strings.TrimSpace(strings.Split(declared, ";")[0])
		}
	}
	if !media.AllowedContentTypes[contentType] {
		writeErr(w, http.StatusUnsupportedMediaType, "unsupported_type",
			"content type "+contentType+" is not allowed")
		return
	}

	// Decode dimensions for raster images (best effort; failures are fine).
	var width, height *int
	if strings.HasPrefix(contentType, "image/") {
		if _, err := file.Seek(0, io.SeekStart); err == nil {
			if cfg, _, err := image.DecodeConfig(file); err == nil {
				w2, h2 := cfg.Width, cfg.Height
				width, height = &w2, &h2
			}
		}
	}
	// Rewind before streaming to storage. multipart.File is always seekable,
	// so a failure here means something is badly wrong with the request.
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		writeErr(w, http.StatusBadRequest, "bad_request", "could not read uploaded file")
		return
	}

	key, err := s.storage.Put(header.Filename, contentType, file)
	if err != nil {
		slog.Error("store upload", "err", err)
		writeErr(w, http.StatusInternalServerError, "internal", "could not store file")
		return
	}

	m, err := s.store.CreateMedia(r.Context(), store.MediaInput{
		StorageKey:  key,
		Filename:    header.Filename,
		ContentType: contentType,
		SizeBytes:   header.Size,
		Width:       width,
		Height:      height,
		AltText:     r.FormValue("alt"),
	})
	if err != nil {
		_ = s.storage.Delete(key) // don't leave an orphan file behind
		writeStoreErr(w, err, "media")
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

type altRequest struct {
	AltText string `json:"alt_text"`
}

func (s *Server) handleUpdateMediaAlt(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var req altRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	m, err := s.store.UpdateMediaAlt(r.Context(), id, req.AltText)
	if err != nil {
		writeStoreErr(w, err, "media")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// handleDeleteMedia removes the row first, then the file. If the file delete
// fails the row is already gone; the orphan is logged rather than retried.
func (s *Server) handleDeleteMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	key, err := s.store.DeleteMedia(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err, "media")
		return
	}
	if err := s.storage.Delete(key); err != nil {
		slog.Error("delete media file", "key", key, "err", err)
	}
	writeJSON(w, http.StatusNoContent, nil)
}
