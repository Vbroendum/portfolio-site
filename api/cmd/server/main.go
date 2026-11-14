// Command server is the portfolio API.
//
// It connects to Postgres, applies any pending migrations, then serves the HTTP
// API on API_ADDR. All configuration comes from the environment; see
// docs/configuration.md for the full list.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/vbroendum/portfolio/api/internal/auth"
	"github.com/vbroendum/portfolio/api/internal/config"
	"github.com/vbroendum/portfolio/api/internal/database"
	"github.com/vbroendum/portfolio/api/internal/httpapi"
	"github.com/vbroendum/portfolio/api/internal/media"
	"github.com/vbroendum/portfolio/api/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	level := slog.LevelDebug
	if cfg.IsProduction() {
		level = slog.LevelInfo
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := database.Connect(ctx, cfg.DatabaseURL, 30*time.Second)
	if err != nil {
		return err
	}
	defer pool.Close()

	applied, err := database.Migrate(ctx, pool)
	if err != nil {
		return err
	}
	if len(applied) > 0 {
		slog.Info("migrations applied", "files", applied)
	}

	storage, err := media.New(cfg.StorageDriver, cfg.StorageLocalDir)
	if err != nil {
		return err
	}

	st := store.New(pool, cfg.PublicMediaBaseURL)
	sessions := auth.NewSessions(cfg.JWTSecret, cfg.SessionTTL, cfg.CookieDomain, cfg.CookieSecure)
	srv := httpapi.NewServer(cfg, st, sessions, storage)

	// Warn loudly if nobody can log in yet.
	if n, err := st.CountUsers(ctx); err == nil && n == 0 {
		slog.Warn("no admin user exists - create one with: go run ./cmd/adminctl create-user -email you@example.com")
	}

	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("api listening", "addr", cfg.Addr, "env", cfg.Env)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		slog.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return httpSrv.Shutdown(shutdownCtx)
	}
}
