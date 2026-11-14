// Package media abstracts where uploaded files live.
//
// Only the local-disk driver ships today. The Storage interface exists so an S3
// driver can be dropped in without touching handlers: implement the three
// methods, add a case to New(), set STORAGE_DRIVER=s3.
package media

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

type Storage interface {
	// Put writes r under a newly generated key derived from filename and
	// returns that key.
	Put(filename string, contentType string, r io.Reader) (string, error)
	// Delete removes the object. Missing objects are not an error.
	Delete(key string) error
	// Handler serves stored objects over HTTP, mounted at /media.
	Handler() http.Handler
}

func New(driver, localDir string) (Storage, error) {
	switch driver {
	case "local":
		return NewLocal(localDir)
	case "s3":
		return nil, fmt.Errorf("the s3 driver is not implemented yet - see docs/architecture.md")
	default:
		return nil, fmt.Errorf("unknown storage driver %q", driver)
	}
}

// Local stores files on disk under root, sharded by year/month so a single
// directory never grows unbounded.
type Local struct {
	root string
}

func NewLocal(root string) (*Local, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, fmt.Errorf("create upload dir %s: %w", abs, err)
	}
	return &Local{root: abs}, nil
}

func (l *Local) Put(filename, contentType string, r io.Reader) (string, error) {
	key := generateKey(filename, contentType)
	full := filepath.Join(l.root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return "", err
	}
	f, err := os.Create(full)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		_ = os.Remove(full)
		return "", err
	}
	return key, nil
}

func (l *Local) Delete(key string) error {
	full, err := l.resolve(key)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// Handler serves the upload directory read-only with long cache headers.
// Keys are content-addressed-ish (random), so files are safe to cache forever.
func (l *Local) Handler() http.Handler {
	fs := http.FileServer(http.Dir(l.root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		fs.ServeHTTP(w, r)
	})
}

// resolve guards against path traversal in a stored key.
func (l *Local) resolve(key string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash("/" + key))
	full := filepath.Join(l.root, clean)
	if !strings.HasPrefix(full, l.root+string(os.PathSeparator)) {
		return "", fmt.Errorf("invalid storage key %q", key)
	}
	return full, nil
}

// generateKey builds "2026/11/<random>-<safe-name><ext>".
func generateKey(filename, contentType string) string {
	ext := strings.ToLower(path.Ext(filename))
	if ext == "" {
		if exts, _ := mime.ExtensionsByType(contentType); len(exts) > 0 {
			ext = exts[0]
		}
	}
	base := strings.TrimSuffix(path.Base(filename), path.Ext(filename))
	base = sanitize(base)
	if base == "" {
		base = "file"
	}
	if len(base) > 40 {
		base = base[:40]
	}
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	now := time.Now().UTC()
	return fmt.Sprintf("%04d/%02d/%s-%s%s", now.Year(), int(now.Month()), hex.EncodeToString(buf), base, ext)
}

func sanitize(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_':
			b.WriteRune('-')
		case r == ' ' || r == '.':
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

// AllowedContentTypes is the upload allowlist. Anything else is rejected with
// 415 so the media library cannot be used to host arbitrary files.
var AllowedContentTypes = map[string]bool{
	"image/png":        true,
	"image/jpeg":       true,
	"image/webp":       true,
	"image/avif":       true,
	"image/gif":        true,
	"image/svg+xml":    true,
	"video/mp4":        true,
	"video/webm":       true,
	"application/pdf":  true,
	"text/plain":       true, // asciinema .cast files
	"application/json": true,
}
