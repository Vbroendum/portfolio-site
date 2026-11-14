package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/vbroendum/portfolio/api/internal/models"
)

// CVEntryInput mirrors models.CVEntry minus server-managed fields.
// Dates are "YYYY-MM-DD" strings or null; the store converts them.
type CVEntryInput struct {
	Kind                models.CVKind `json:"kind"`
	Title               string        `json:"title"`
	Organization        string        `json:"organization"`
	Location            string        `json:"location"`
	StartDate           *string       `json:"start_date"`
	EndDate             *string       `json:"end_date"`
	IsCurrent           bool          `json:"is_current"`
	DescriptionMarkdown string        `json:"description_markdown"`
	Highlights          []string      `json:"highlights"`
	SortOrder           int           `json:"sort_order"`
}

const dateLayout = "2006-01-02"

func parseDate(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse(dateLayout, *s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func formatDate(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(dateLayout)
	return &s
}

func scanCVEntry(row pgx.Row) (*models.CVEntry, error) {
	var e models.CVEntry
	var start, end *time.Time
	err := row.Scan(&e.ID, &e.Kind, &e.Title, &e.Organization, &e.Location,
		&start, &end, &e.IsCurrent, &e.DescriptionMarkdown, &e.Highlights,
		&e.SortOrder, &e.CreatedAt, &e.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	e.StartDate = formatDate(start)
	e.EndDate = formatDate(end)
	return &e, nil
}

const cvColumns = `id, kind, title, organization, location, start_date, end_date,
	is_current, description_markdown, highlights, sort_order, created_at, updated_at`

// ListCVEntries returns every entry ordered for display: grouped by kind, then
// by sort_order, then most recent first.
func (s *Store) ListCVEntries(ctx context.Context, kind string) ([]models.CVEntry, error) {
	q := `SELECT ` + cvColumns + ` FROM cv_entries`
	args := []any{}
	if kind != "" {
		q += ` WHERE kind = $1`
		args = append(args, kind)
	}
	q += ` ORDER BY kind ASC, sort_order ASC, start_date DESC NULLS LAST`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.CVEntry{}
	for rows.Next() {
		e, err := scanCVEntry(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

func (s *Store) GetCVEntry(ctx context.Context, id uuid.UUID) (*models.CVEntry, error) {
	return scanCVEntry(s.pool.QueryRow(ctx, `SELECT `+cvColumns+` FROM cv_entries WHERE id = $1`, id))
}

func (s *Store) CreateCVEntry(ctx context.Context, in CVEntryInput) (*models.CVEntry, error) {
	start, err := parseDate(in.StartDate)
	if err != nil {
		return nil, err
	}
	end, err := parseDate(in.EndDate)
	if err != nil {
		return nil, err
	}
	if in.Kind == "" {
		in.Kind = models.CVExperience
	}
	if in.Highlights == nil {
		in.Highlights = []string{}
	}
	var id uuid.UUID
	err = s.pool.QueryRow(ctx, `
		INSERT INTO cv_entries (kind, title, organization, location, start_date, end_date,
		                        is_current, description_markdown, highlights, sort_order)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		in.Kind, in.Title, in.Organization, in.Location, start, end,
		in.IsCurrent, in.DescriptionMarkdown, in.Highlights, in.SortOrder,
	).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetCVEntry(ctx, id)
}

func (s *Store) UpdateCVEntry(ctx context.Context, id uuid.UUID, in CVEntryInput) (*models.CVEntry, error) {
	start, err := parseDate(in.StartDate)
	if err != nil {
		return nil, err
	}
	end, err := parseDate(in.EndDate)
	if err != nil {
		return nil, err
	}
	if in.Highlights == nil {
		in.Highlights = []string{}
	}
	tag, err := s.pool.Exec(ctx, `
		UPDATE cv_entries SET kind=$2, title=$3, organization=$4, location=$5,
			start_date=$6, end_date=$7, is_current=$8, description_markdown=$9,
			highlights=$10, sort_order=$11, updated_at=now()
		WHERE id=$1`,
		id, in.Kind, in.Title, in.Organization, in.Location, start, end,
		in.IsCurrent, in.DescriptionMarkdown, in.Highlights, in.SortOrder)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetCVEntry(ctx, id)
}

func (s *Store) DeleteCVEntry(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM cv_entries WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ReorderCVEntries applies a new sort_order to a list of ids in one transaction.
// The CMS sends the full ordered list of ids for a single kind.
func (s *Store) ReorderCVEntries(ctx context.Context, ids []uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for i, id := range ids {
		if _, err := tx.Exec(ctx, `UPDATE cv_entries SET sort_order=$2, updated_at=now() WHERE id=$1`, id, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
