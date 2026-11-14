package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/vbroendum/portfolio/api/internal/models"
)

// GetSetting returns one settings blob. Unknown keys are ErrNotFound.
func (s *Store) GetSetting(ctx context.Context, key string) (*models.Setting, error) {
	var out models.Setting
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT key, value, updated_at FROM settings WHERE key = $1`, key).
		Scan(&out.Key, &raw, &out.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &out.Value); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetAllSettings returns every blob keyed by name. The frontend fetches this
// once per render to build the header, footer and SEO tags.
func (s *Store) GetAllSettings(ctx context.Context) (map[string]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]map[string]any{}
	for rows.Next() {
		var key string
		var raw []byte
		if err := rows.Scan(&key, &raw); err != nil {
			return nil, err
		}
		var v map[string]any
		if err := json.Unmarshal(raw, &v); err != nil {
			return nil, err
		}
		out[key] = v
	}
	return out, rows.Err()
}

// PutSetting upserts a blob wholesale. The CMS always sends the full object.
func (s *Store) PutSetting(ctx context.Context, key string, value map[string]any) (*models.Setting, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, key, raw)
	if err != nil {
		return nil, err
	}
	return s.GetSetting(ctx, key)
}
