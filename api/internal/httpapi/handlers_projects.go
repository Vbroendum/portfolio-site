package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/vbroendum/portfolio/api/internal/models"
	"github.com/vbroendum/portfolio/api/internal/store"
)

// ---- public ---------------------------------------------------------------

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	s.listProjects(w, r, false)
}

func (s *Server) handleGetProjectBySlug(w http.ResponseWriter, r *http.Request) {
	loc, ok := publicLocale(w, r)
	if !ok {
		return
	}
	p, err := s.store.GetProjectBySlug(r.Context(), chi.URLParam(r, "slug"), false, loc)
	if err != nil {
		writeStoreErr(w, err, "project")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleListTech(w http.ResponseWriter, r *http.Request) {
	tech, err := s.store.ListTech(r.Context())
	if err != nil {
		writeStoreErr(w, err, "tech")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": tech})
}

// ---- admin ----------------------------------------------------------------

func (s *Server) handleAdminListProjects(w http.ResponseWriter, r *http.Request) {
	s.listProjects(w, r, true)
}

func (s *Server) handleAdminGetProject(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	p, err := s.store.GetProject(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err, "project")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var in store.ProjectInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if !validateProject(w, in) {
		return
	}
	p, err := s.store.CreateProject(r.Context(), in)
	if err != nil {
		writeStoreErr(w, err, "project")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	var in store.ProjectInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if !validateProject(w, in) {
		return
	}
	p, err := s.store.UpdateProject(r.Context(), id, in)
	if err != nil {
		writeStoreErr(w, err, "project")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	if err := s.store.DeleteProject(r.Context(), id); err != nil {
		writeStoreErr(w, err, "project")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// ---- shared ---------------------------------------------------------------

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request, includeDrafts bool) {
	// Admin lists are raw so the CMS sees every language; public ones are
	// localized.
	var loc models.Locale
	if !includeDrafts {
		var ok bool
		if loc, ok = publicLocale(w, r); !ok {
			return
		}
	}
	f := store.ProjectFilter{
		Locale:        loc,
		IncludeDrafts: includeDrafts,
		FeaturedOnly:  queryBool(r, "featured"),
		Tech:          r.URL.Query().Get("tech"),
		Limit:         queryInt(r, "limit", 50),
		Offset:        queryInt(r, "offset", 0),
	}
	items, total, err := s.store.ListProjects(r.Context(), f)
	if err != nil {
		writeStoreErr(w, err, "projects")
		return
	}
	writeJSON(w, http.StatusOK, ListEnvelope[models.Project]{
		Items: items, Total: total, Limit: f.Limit, Offset: f.Offset,
	})
}

func validateProject(w http.ResponseWriter, in store.ProjectInput) bool {
	if in.Title == "" {
		writeErr(w, http.StatusUnprocessableEntity, "validation", "title is required")
		return false
	}
	if in.Status != "" && !in.Status.Valid() {
		writeErr(w, http.StatusUnprocessableEntity, "validation", "status must be 'draft' or 'published'")
		return false
	}
	if in.DemoType != "" && !in.DemoType.Valid() {
		writeErr(w, http.StatusUnprocessableEntity, "validation",
			"demo_type must be one of none, iframe, video, asciinema, gallery")
		return false
	}
	// A demo that needs a URL but has none renders as an empty box - catch it here.
	switch in.DemoType {
	case models.DemoIframe, models.DemoVideo, models.DemoAsciinema:
		if in.DemoURL == "" {
			writeErr(w, http.StatusUnprocessableEntity, "validation",
				"demo_url is required when demo_type is "+string(in.DemoType))
			return false
		}
	}
	return validTranslations(w, in.Translations)
}
