package store

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/vbroendum/portfolio/api/internal/models"
)

// mediaURL turns a storage key into a public URL. With the local driver this is
// PUBLIC_MEDIA_BASE_URL + "/" + key; with S3 it is the bucket's public base.
func (s *Store) mediaURL(key string) string {
	return s.mediaBaseURL + "/" + strings.TrimLeft(key, "/")
}

// MediaInput is recorded after the bytes have been written to storage.
type MediaInput struct {
	StorageKey  string
	Filename    string
	ContentType string
	SizeBytes   int64
	Width       *int
	Height      *int
	AltText     string
}

func (s *Store) CreateMedia(ctx context.Context, in MediaInput) (*models.Media, error) {
	var id uuid.UUID
	err := s.pool.QueryRow(ctx, `
		INSERT INTO media (storage_key, filename, content_type, size_bytes, width, height, alt_text)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id`,
		in.StorageKey, in.Filename, in.ContentType, in.SizeBytes, in.Width, in.Height, in.AltText,
	).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetMedia(ctx, id)
}

func (s *Store) GetMedia(ctx context.Context, id uuid.UUID) (*models.Media, error) {
	var m models.Media
	err := s.pool.QueryRow(ctx, `
		SELECT id, storage_key, filename, content_type, size_bytes, width, height, alt_text, created_at
		FROM media WHERE id = $1`, id).
		Scan(&m.ID, &m.StorageKey, &m.Filename, &m.ContentType, &m.SizeBytes,
			&m.Width, &m.Height, &m.AltText, &m.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	m.URL = s.mediaURL(m.StorageKey)
	return &m, nil
}

func (s *Store) ListMedia(ctx context.Context, limit, offset int) ([]models.Media, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 60
	}
	var total int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM media`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, storage_key, filename, content_type, size_bytes, width, height, alt_text, created_at
		FROM media ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.Media{}
	for rows.Next() {
		var m models.Media
		if err := rows.Scan(&m.ID, &m.StorageKey, &m.Filename, &m.ContentType, &m.SizeBytes,
			&m.Width, &m.Height, &m.AltText, &m.CreatedAt); err != nil {
			return nil, 0, err
		}
		m.URL = s.mediaURL(m.StorageKey)
		out = append(out, m)
	}
	return out, total, rows.Err()
}

func (s *Store) UpdateMediaAlt(ctx context.Context, id uuid.UUID, alt string) (*models.Media, error) {
	tag, err := s.pool.Exec(ctx, `UPDATE media SET alt_text = $2 WHERE id = $1`, id, alt)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetMedia(ctx, id)
}

// DeleteMedia removes the row and returns the storage key so the caller can
// delete the underlying file. Rows referencing it keep working: cover_media_id
// is ON DELETE SET NULL and gallery rows cascade.
func (s *Store) DeleteMedia(ctx context.Context, id uuid.UUID) (string, error) {
	var key string
	err := s.pool.QueryRow(ctx, `DELETE FROM media WHERE id = $1 RETURNING storage_key`, id).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return key, err
}
