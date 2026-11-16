package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/vbroendum/portfolio/api/internal/models"
	"github.com/vbroendum/portfolio/api/internal/store"
)

// ---- public ---------------------------------------------------------------

func (s *Server) handleListPosts(w http.ResponseWriter, r *http.Request) {
	s.listPosts(w, r, false)
}

func (s *Server) handleGetPostBySlug(w http.ResponseWriter, r *http.Request) {
	loc, ok := publicLocale(w, r)
	if !ok {
		return
	}
	post, err := s.store.GetPostBySlug(r.Context(), chi.URLParam(r, "slug"), false, loc)
	if err != nil {
		writeStoreErr(w, err, "post")
		return
	}
	writeJSON(w, http.StatusOK, post)
}

func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.store.ListTags(r.Context())
	if err != nil {
		writeStoreErr(w, err, "tags")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": tags})
}

// ---- admin ----------------------------------------------------------------

func (s *Server) handleAdminListPosts(w http.ResponseWriter, r *http.Request) {
	s.listPosts(w, r, true)
}

func (s *Server) handleAdminGetPost(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	post, err := s.store.GetPost(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err, "post")
		return
	}
	writeJSON(w, http.StatusOK, post)
}

func (s *Server) handleCreatePost(w http.ResponseWriter, r *http.Request) {
	var in store.PostInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if !validatePost(w, in) {
		return
	}
	post, err := s.store.CreatePost(r.Context(), in)
	if err != nil {
		writeStoreErr(w, err, "post")
		return
	}
	writeJSON(w, http.StatusCreated, post)
}

func (s *Server) handleUpdatePost(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var in store.PostInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if !validatePost(w, in) {
		return
	}
	post, err := s.store.UpdatePost(r.Context(), id, in)
	if err != nil {
		writeStoreErr(w, err, "post")
		return
	}
	writeJSON(w, http.StatusOK, post)
}

func (s *Server) handleDeletePost(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := s.store.DeletePost(r.Context(), id); err != nil {
		writeStoreErr(w, err, "post")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// ---- shared ---------------------------------------------------------------

func (s *Server) listPosts(w http.ResponseWriter, r *http.Request, includeDrafts bool) {
	// Admin lists are raw so the CMS sees every language; public ones are
	// localized.
	var loc models.Locale
	if !includeDrafts {
		var ok bool
		if loc, ok = publicLocale(w, r); !ok {
			return
		}
	}
	f := store.PostFilter{
		Locale:        loc,
		IncludeDrafts: includeDrafts,
		Tag:           r.URL.Query().Get("tag"),
		Search:        r.URL.Query().Get("q"),
		Limit:         queryInt(r, "limit", 20),
		Offset:        queryInt(r, "offset", 0),
	}
	posts, total, err := s.store.ListPosts(r.Context(), f)
	if err != nil {
		writeStoreErr(w, err, "posts")
		return
	}
	writeJSON(w, http.StatusOK, ListEnvelope[models.Post]{
		Items: posts, Total: total, Limit: f.Limit, Offset: f.Offset,
	})
}

func validatePost(w http.ResponseWriter, in store.PostInput) bool {
	if in.Title == "" {
		writeErr(w, http.StatusUnprocessableEntity, "validation", "title is required")
		return false
	}
	if in.Status != "" && !in.Status.Valid() {
		writeErr(w, http.StatusUnprocessableEntity, "validation", "status must be 'draft' or 'published'")
		return false
	}
	return validTranslations(w, in.Translations)
}
