package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// allowedSettingKeys keeps the settings table from becoming a junk drawer.
// Add a key here (and document it in docs/cms.md) when you add a new section.
var allowedSettingKeys = map[string]bool{
	"site":    true,
	"about":   true,
	"socials": true,
}

// handleGetSettings returns every settings blob in one call - the public site
// needs them on every page render.
func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	all, err := s.store.GetAllSettings(r.Context())
	if err != nil {
		writeStoreErr(w, err, "settings")
		return
	}
	writeJSON(w, http.StatusOK, all)
}

func (s *Server) handleAdminGetSettings(w http.ResponseWriter, r *http.Request) {
	s.handleGetSettings(w, r)
}

func (s *Server) handlePutSetting(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if !allowedSettingKeys[key] {
		writeErr(w, http.StatusBadRequest, "bad_request", "unknown settings key: "+key)
		return
	}
	var value map[string]any
	if !decodeJSON(w, r, &value) {
		return
	}
	setting, err := s.store.PutSetting(r.Context(), key, value)
	if err != nil {
		writeStoreErr(w, err, "settings")
		return
	}
	writeJSON(w, http.StatusOK, setting)
}
