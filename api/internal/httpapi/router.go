package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/vbroendum/portfolio/api/internal/auth"
	"github.com/vbroendum/portfolio/api/internal/config"
	"github.com/vbroendum/portfolio/api/internal/media"
	"github.com/vbroendum/portfolio/api/internal/store"
)

// Server holds the dependencies every handler needs.
type Server struct {
	cfg      *config.Config
	store    *store.Store
	sessions *auth.Sessions
	storage  media.Storage
}

func NewServer(cfg *config.Config, st *store.Store, sessions *auth.Sessions, storage media.Storage) *Server {
	return &Server{cfg: cfg, store: st, sessions: sessions, storage: storage}
}

// Routes builds the full router.
//
// Layout:
//
//	GET  /healthz                      liveness + db ping
//	GET  /media/*                      uploaded files (local driver only)
//	     /api/v1/...                   public, read-only, published content
//	     /api/v1/auth/...              login / logout / me
//	     /api/v1/admin/...             everything behind the session cookie
func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(requestLogger)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true, // the session cookie must survive cross-origin dev
		MaxAge:           300,
	}))

	r.Get("/healthz", s.handleHealth)
	r.Handle("/media/*", http.StripPrefix("/media/", s.storage.Handler()))

	r.Route("/api/v1", func(r chi.Router) {
		// ---- public ----------------------------------------------------
		r.Get("/posts", s.handleListPosts)
		r.Get("/posts/{slug}", s.handleGetPostBySlug)
		r.Get("/tags", s.handleListTags)

		r.Get("/projects", s.handleListProjects)
		r.Get("/projects/{slug}", s.handleGetProjectBySlug)
		r.Get("/tech", s.handleListTech)

		r.Get("/cv", s.handleListCV)
		r.Get("/settings", s.handleGetSettings)
		r.Get("/feed.xml", s.handleRSS)

		// ---- auth ------------------------------------------------------
		r.Route("/auth", func(r chi.Router) {
			r.With(loginRateLimit()).Post("/login", s.handleLogin)
			r.Post("/logout", s.handleLogout)
			r.Get("/me", s.handleMe)
		})

		// ---- admin (session cookie required) ---------------------------
		r.Route("/admin", func(r chi.Router) {
			r.Use(s.sessions.RequireAuth)

			r.Route("/posts", func(r chi.Router) {
				r.Get("/", s.handleAdminListPosts)
				r.Post("/", s.handleCreatePost)
				r.Get("/{id}", s.handleAdminGetPost)
				r.Put("/{id}", s.handleUpdatePost)
				r.Delete("/{id}", s.handleDeletePost)
			})

			r.Route("/projects", func(r chi.Router) {
				r.Get("/", s.handleAdminListProjects)
				r.Post("/", s.handleCreateProject)
				r.Get("/{id}", s.handleAdminGetProject)
				r.Put("/{id}", s.handleUpdateProject)
				r.Delete("/{id}", s.handleDeleteProject)
			})

			r.Route("/cv", func(r chi.Router) {
				r.Get("/", s.handleAdminListCV)
				r.Post("/", s.handleCreateCV)
				r.Put("/reorder", s.handleReorderCV)
				r.Put("/{id}", s.handleUpdateCV)
				r.Delete("/{id}", s.handleDeleteCV)
			})

			r.Route("/media", func(r chi.Router) {
				r.Get("/", s.handleListMedia)
				r.Post("/", s.handleUploadMedia)
				r.Patch("/{id}", s.handleUpdateMediaAlt)
				r.Delete("/{id}", s.handleDeleteMedia)
			})

			r.Get("/settings", s.handleAdminGetSettings)
			r.Put("/settings/{key}", s.handlePutSetting)
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		writeErr(w, http.StatusNotFound, "not_found", "no such endpoint")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		writeErr(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed on this endpoint")
	})

	return r
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Pool().Ping(r.Context()); err != nil {
		writeErr(w, http.StatusServiceUnavailable, "unhealthy", "database unreachable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
