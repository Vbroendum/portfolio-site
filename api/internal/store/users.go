package store

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/vbroendum/portfolio/api/internal/models"
)

// UserWithHash is only used by the auth layer; the hash never leaves it.
type UserWithHash struct {
	models.User
	PasswordHash string
}

func (s *Store) CreateUser(ctx context.Context, email, name, passwordHash string) (*models.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u models.User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3)
		RETURNING id, email, name, created_at`, email, name, passwordHash).
		Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	if err != nil {
		return nil, mapErr(err)
	}
	return &u, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*UserWithHash, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u UserWithHash
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1`, email).
		Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetUser(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, name, created_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) SetUserPassword(ctx context.Context, id uuid.UUID, hash string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, hash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) CountUsers(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}
