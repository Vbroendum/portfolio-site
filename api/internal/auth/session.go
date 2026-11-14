package auth

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// SessionCookieName is also referenced by the Next.js proxy when it forwards
// admin requests, so changing it means changing web/lib/api/server.ts too.
const SessionCookieName = "portfolio_session"

var ErrNoSession = errors.New("no session")

// Sessions mints and validates the signed cookie that proves "I am the admin".
//
// The token is stateless: there is no session table, so logging out everywhere
// means rotating JWT_SECRET. For a single-author site that trade is worth the
// simplicity.
type Sessions struct {
	secret       []byte
	ttl          time.Duration
	cookieDomain string
	cookieSecure bool
}

func NewSessions(secret []byte, ttl time.Duration, cookieDomain string, cookieSecure bool) *Sessions {
	return &Sessions{secret: secret, ttl: ttl, cookieDomain: cookieDomain, cookieSecure: cookieSecure}
}

type Claims struct {
	jwt.RegisteredClaims
	Email string `json:"email"`
}

// Issue writes a fresh session cookie onto the response.
func (s *Sessions) Issue(w http.ResponseWriter, userID uuid.UUID, email string) error {
	now := time.Now()
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
		},
		Email: email,
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    signed,
		Path:     "/",
		Domain:   s.cookieDomain,
		Expires:  now.Add(s.ttl),
		MaxAge:   int(s.ttl.Seconds()),
		HttpOnly: true,
		Secure:   s.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// Clear expires the session cookie.
func (s *Sessions) Clear(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		Domain:   s.cookieDomain,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// Parse validates the cookie on a request and returns the user id.
func (s *Sessions) Parse(r *http.Request) (uuid.UUID, string, error) {
	c, err := r.Cookie(SessionCookieName)
	if err != nil || c.Value == "" {
		return uuid.Nil, "", ErrNoSession
	}
	var claims Claims
	token, err := jwt.ParseWithClaims(c.Value, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !token.Valid {
		return uuid.Nil, "", ErrNoSession
	}
	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, "", ErrNoSession
	}
	return id, claims.Email, nil
}

type ctxKey int

const userKey ctxKey = iota

// WithUser stores the authenticated user id on the request context.
func WithUser(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, userKey, id)
}

// UserFrom reads the authenticated user id back out. ok is false for anonymous.
func UserFrom(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userKey).(uuid.UUID)
	return id, ok
}

// RequireAuth rejects anything without a valid session cookie. Mounted on the
// whole /api/v1/admin subtree.
func (s *Sessions) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, _, err := s.Parse(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":{"code":"unauthorized","message":"authentication required"}}`))
			return
		}
		next.ServeHTTP(w, r.WithContext(WithUser(r.Context(), id)))
	})
}
