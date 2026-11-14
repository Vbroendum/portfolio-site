// Package config loads all runtime configuration from the environment.
//
// Everything the server needs is an env var - there is no config file - so the
// same binary runs unchanged in Docker, on a VPS, or on your laptop.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// Addr is the listen address, e.g. ":8080".
	Addr string
	// DatabaseURL is a libpq connection string.
	DatabaseURL string
	// JWTSecret signs admin session cookies. Must be >= 32 bytes in production.
	JWTSecret []byte
	// SessionTTL is how long an admin login lasts.
	SessionTTL time.Duration
	// CookieDomain scopes the session cookie; empty means host-only.
	CookieDomain string
	// CookieSecure marks the session cookie Secure (required in production).
	CookieSecure bool
	// CORSOrigins lists browser origins allowed to call the API with credentials.
	CORSOrigins []string
	// StorageDriver is "local" or "s3".
	StorageDriver string
	// StorageLocalDir is where uploads land when StorageDriver == "local".
	StorageLocalDir string
	// PublicMediaBaseURL is prefixed to a media storage key to build its URL.
	PublicMediaBaseURL string
	// PublicSiteURL is the public origin of the frontend; used for RSS links.
	PublicSiteURL string
	// MaxUploadBytes caps a single upload.
	MaxUploadBytes int64
	// Env is "development" or "production"; only affects logging + defaults.
	Env string
}

// Load reads the environment and validates it. It returns an error rather than
// exiting so tests can construct a Config directly.
func Load() (*Config, error) {
	c := &Config{
		Addr:               envStr("API_ADDR", ":8080"),
		DatabaseURL:        envStr("DATABASE_URL", ""),
		JWTSecret:          []byte(envStr("JWT_SECRET", "")),
		SessionTTL:         envDur("SESSION_TTL", 7*24*time.Hour),
		CookieDomain:       envStr("COOKIE_DOMAIN", ""),
		CookieSecure:       envBool("COOKIE_SECURE", false),
		CORSOrigins:        envList("CORS_ORIGINS", "http://localhost:3000"),
		StorageDriver:      envStr("STORAGE_DRIVER", "local"),
		StorageLocalDir:    envStr("STORAGE_LOCAL_DIR", "./data/uploads"),
		PublicMediaBaseURL: strings.TrimRight(envStr("PUBLIC_MEDIA_BASE_URL", "http://localhost:8080/media"), "/"),
		PublicSiteURL:      strings.TrimRight(envStr("PUBLIC_SITE_URL", "http://localhost:3000"), "/"),
		MaxUploadBytes:     envInt64("MAX_UPLOAD_BYTES", 25<<20), // 25 MiB
		Env:                envStr("APP_ENV", "development"),
	}

	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if len(c.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 bytes (got %d); generate one with: openssl rand -base64 48", len(c.JWTSecret))
	}
	if c.StorageDriver != "local" && c.StorageDriver != "s3" {
		return nil, fmt.Errorf("STORAGE_DRIVER must be 'local' or 's3', got %q", c.StorageDriver)
	}
	return c, nil
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

func envStr(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func envInt64(key string, def int64) int64 {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return def
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return def
	}
	return n
}

func envDur(key string, def time.Duration) time.Duration {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}

func envList(key, def string) []string {
	raw := envStr(key, def)
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
