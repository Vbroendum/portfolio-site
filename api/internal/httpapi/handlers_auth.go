package httpapi

import (
	"errors"
	"net/http"

	"github.com/vbroendum/portfolio/api/internal/auth"
	"github.com/vbroendum/portfolio/api/internal/store"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// handleLogin verifies credentials and sets the session cookie.
//
// Unknown email and wrong password return the same 401 so the endpoint does not
// confirm which accounts exist.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Email == "" || req.Password == "" {
		writeErr(w, http.StatusBadRequest, "bad_request", "email and password are required")
		return
	}

	user, err := s.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
			return
		}
		writeStoreErr(w, err, "user")
		return
	}
	if err := auth.VerifyPassword(req.Password, user.PasswordHash); err != nil {
		writeErr(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if err := s.sessions.Issue(w, user.ID, user.Email); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal", "could not start session")
		return
	}
	writeJSON(w, http.StatusOK, user.User)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.sessions.Clear(w)
	writeJSON(w, http.StatusNoContent, nil)
}

// handleMe lets the admin UI check whether the current cookie is still valid.
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	id, _, err := s.sessions.Parse(r)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "unauthorized", "not signed in")
		return
	}
	user, err := s.store.GetUser(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "unauthorized", "not signed in")
		return
	}
	writeJSON(w, http.StatusOK, user)
}
