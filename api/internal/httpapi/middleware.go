package httpapi

import (
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// requestLogger emits one structured line per request.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		slog.Info("http",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"ms", time.Since(start).Milliseconds(),
			"request_id", middleware.GetReqID(r.Context()),
		)
	})
}

// loginRateLimit throttles password attempts per client IP: 10 per 15 minutes.
// It is deliberately a tiny in-memory bucket - one API instance, one author.
// If you ever run more than one replica, move this to Postgres or Redis.
func loginRateLimit() func(http.Handler) http.Handler {
	const (
		maxAttempts = 10
		window      = 15 * time.Minute
	)
	var (
		mu      sync.Mutex
		buckets = map[string][]time.Time{}
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = r.RemoteAddr
			}

			mu.Lock()
			cutoff := time.Now().Add(-window)
			kept := buckets[ip][:0]
			for _, t := range buckets[ip] {
				if t.After(cutoff) {
					kept = append(kept, t)
				}
			}
			over := len(kept) >= maxAttempts
			if !over {
				kept = append(kept, time.Now())
			}
			buckets[ip] = kept
			// Opportunistic cleanup so the map cannot grow without bound.
			if len(buckets) > 1000 {
				for k, v := range buckets {
					if len(v) == 0 {
						delete(buckets, k)
					}
				}
			}
			mu.Unlock()

			if over {
				w.Header().Set("Retry-After", "900")
				writeErr(w, http.StatusTooManyRequests, "rate_limited", "too many login attempts, try again later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
