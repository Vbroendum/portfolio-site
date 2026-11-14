// Package store is the only place that talks SQL. Handlers call methods here;
// they never build queries themselves.
//
// Conventions used throughout:
//   - Every method takes a context and returns domain types from internal/models.
//   - "not found" is reported as ErrNotFound so the HTTP layer can map it to 404.
//   - A unique-constraint violation on a slug becomes ErrConflict -> 409.
package store

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)

type Store struct {
	pool *pgxpool.Pool
	// mediaBaseURL is prefixed to a media storage key to produce a public URL.
	mediaBaseURL string
}

func New(pool *pgxpool.Pool, mediaBaseURL string) *Store {
	return &Store{pool: pool, mediaBaseURL: strings.TrimRight(mediaBaseURL, "/")}
}

// Pool exposes the underlying pool for health checks and one-off CLI commands.
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// mapErr converts driver-specific errors into the package's sentinel errors.
func mapErr(err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		return ErrConflict
	}
	return err
}

var slugStrip = regexp.MustCompile(`[^a-z0-9]+`)

// Slugify turns a title into a URL-safe slug. Danish letters are transliterated
// so "Æbleskiver på GitHub" becomes "aebleskiver-paa-github".
func Slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	replacer := strings.NewReplacer(
		"æ", "ae", "ø", "oe", "å", "aa",
		"ä", "ae", "ö", "oe", "ü", "ue", "ß", "ss",
		"é", "e", "è", "e", "ê", "e", "á", "a", "à", "a", "í", "i", "ó", "o", "ú", "u",
	)
	s = replacer.Replace(s)
	s = slugStrip.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "untitled"
	}
	if len(s) > 80 {
		s = strings.Trim(s[:80], "-")
	}
	return s
}

// ReadingMinutes estimates reading time at 220 words per minute, minimum 1.
func ReadingMinutes(markdown string) int {
	if utf8.RuneCountInString(markdown) == 0 {
		return 0
	}
	words := len(strings.Fields(markdown))
	m := (words + 219) / 220
	if m < 1 {
		m = 1
	}
	return m
}

// nilIfEmpty is a small helper for optional text columns.
func nilIfEmpty(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}
