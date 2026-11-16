package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/vbroendum/portfolio/api/internal/models"
	"github.com/vbroendum/portfolio/api/internal/store"
)

// handleListCV is public: a CV has nothing to hide behind a draft flag.
func (s *Server) handleListCV(w http.ResponseWriter, r *http.Request) {
	loc, ok := publicLocale(w, r)
	if !ok {
		return
	}
	s.listCV(w, r, loc)
}

// handleAdminListCV is raw: the CMS edits every language at once.
func (s *Server) handleAdminListCV(w http.ResponseWriter, r *http.Request) {
	s.listCV(w, r, "")
}

func (s *Server) listCV(w http.ResponseWriter, r *http.Request, loc models.Locale) {
	entries, err := s.store.ListCVEntries(r.Context(), r.URL.Query().Get("kind"), loc)
	if err != nil {
		writeStoreErr(w, err, "cv")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": entries})
}

func (s *Server) handleCreateCV(w http.ResponseWriter, r *http.Request) {
	var in store.CVEntryInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if !validateCV(w, in) {
		return
	}
	e, err := s.store.CreateCVEntry(r.Context(), in)
	if err != nil {
		writeStoreErr(w, err, "cv entry")
		return
	}
	writeJSON(w, http.StatusCreated, e)
}

func (s *Server) handleUpdateCV(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var in store.CVEntryInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if !validateCV(w, in) {
		return
	}
	e, err := s.store.UpdateCVEntry(r.Context(), id, in)
	if err != nil {
		writeStoreErr(w, err, "cv entry")
		return
	}
	writeJSON(w, http.StatusOK, e)
}

func (s *Server) handleDeleteCV(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := s.store.DeleteCVEntry(r.Context(), id); err != nil {
		writeStoreErr(w, err, "cv entry")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type reorderRequest struct {
	IDs []uuid.UUID `json:"ids"`
}

// handleReorderCV takes the full ordered id list for one section.
func (s *Server) handleReorderCV(w http.ResponseWriter, r *http.Request) {
	var req reorderRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := s.store.ReorderCVEntries(r.Context(), req.IDs); err != nil {
		writeStoreErr(w, err, "cv entries")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func validateCV(w http.ResponseWriter, in store.CVEntryInput) bool {
	if in.Title == "" {
		writeErr(w, http.StatusUnprocessableEntity, "validation", "title is required")
		return false
	}
	if in.Kind != "" && !in.Kind.Valid() {
		writeErr(w, http.StatusUnprocessableEntity, "validation",
			"kind must be one of experience, education, skill, certification, other")
		return false
	}
	return validTranslations(w, in.Translations)
}
