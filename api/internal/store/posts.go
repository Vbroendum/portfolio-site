package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/vbroendum/portfolio/api/internal/models"
)

// PostInput is what the CMS sends when creating or updating a post.
// Slug is optional on create: it is derived from Title when blank.
type PostInput struct {
	Slug         string        `json:"slug"`
	Title        string        `json:"title"`
	Summary      string        `json:"summary"`
	BodyMarkdown string        `json:"body_markdown"`
	CoverMediaID *uuid.UUID    `json:"cover_media_id"`
	Tags         []string      `json:"tags"`
	Status       models.Status `json:"status"`
	PublishedAt  *time.Time    `json:"published_at"`
}

// PostFilter narrows a list query. Zero value = published posts, newest first.
type PostFilter struct {
	// IncludeDrafts is only ever set by authenticated admin endpoints.
	IncludeDrafts bool
	Tag           string
	Search        string
	Limit         int
	Offset        int
}

const postColumns = `
	p.id, p.slug, p.title, p.summary, p.body_markdown, p.cover_media_id,
	p.tags, p.status, p.reading_minutes, p.published_at, p.created_at, p.updated_at,
	m.id, m.storage_key, m.filename, m.content_type, m.size_bytes, m.width, m.height, m.alt_text, m.created_at`

func (s *Store) scanPost(row pgx.Row) (*models.Post, error) {
	var p models.Post
	var mID *uuid.UUID
	var mKey, mFilename, mType, mAlt *string
	var mSize *int64
	var mW, mH *int
	var mCreated *time.Time

	err := row.Scan(
		&p.ID, &p.Slug, &p.Title, &p.Summary, &p.BodyMarkdown, &p.CoverMediaID,
		&p.Tags, &p.Status, &p.ReadingMinutes, &p.PublishedAt, &p.CreatedAt, &p.UpdatedAt,
		&mID, &mKey, &mFilename, &mType, &mSize, &mW, &mH, &mAlt, &mCreated,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if mID != nil {
		p.Cover = &models.Media{
			ID: *mID, StorageKey: *mKey, URL: s.mediaURL(*mKey),
			Filename: *mFilename, ContentType: *mType, SizeBytes: *mSize,
			Width: mW, Height: mH, AltText: *mAlt, CreatedAt: *mCreated,
		}
	}
	return &p, nil
}

func (s *Store) ListPosts(ctx context.Context, f PostFilter) ([]models.Post, int, error) {
	where := []string{}
	args := []any{}
	add := func(clause string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(clause, len(args)))
	}

	if !f.IncludeDrafts {
		where = append(where, "p.status = 'published'", "p.published_at IS NOT NULL", "p.published_at <= now()")
	}
	if f.Tag != "" {
		add("$%d = ANY(p.tags)", f.Tag)
	}
	if f.Search != "" {
		args = append(args, f.Search)
		n := len(args)
		where = append(where, fmt.Sprintf(
			"(p.title ILIKE '%%' || $%d || '%%' OR p.summary ILIKE '%%' || $%d || '%%' OR p.body_markdown ILIKE '%%' || $%d || '%%')",
			n, n, n))
	}
	clause := ""
	if len(where) > 0 {
		clause = "WHERE " + strings.Join(where, " AND ")
	}

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM posts p `+clause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	args = append(args, limit, f.Offset)
	q := fmt.Sprintf(`
		SELECT %s
		FROM posts p
		LEFT JOIN media m ON m.id = p.cover_media_id
		%s
		ORDER BY COALESCE(p.published_at, p.created_at) DESC
		LIMIT $%d OFFSET $%d`, postColumns, clause, len(args)-1, len(args))

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []models.Post{}
	for rows.Next() {
		p, err := s.scanPost(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *p)
	}
	return out, total, rows.Err()
}

func (s *Store) GetPostBySlug(ctx context.Context, slug string, includeDrafts bool) (*models.Post, error) {
	q := fmt.Sprintf(`
		SELECT %s FROM posts p
		LEFT JOIN media m ON m.id = p.cover_media_id
		WHERE p.slug = $1`, postColumns)
	if !includeDrafts {
		q += ` AND p.status = 'published' AND p.published_at IS NOT NULL AND p.published_at <= now()`
	}
	return s.scanPost(s.pool.QueryRow(ctx, q, slug))
}

func (s *Store) GetPost(ctx context.Context, id uuid.UUID) (*models.Post, error) {
	q := fmt.Sprintf(`
		SELECT %s FROM posts p
		LEFT JOIN media m ON m.id = p.cover_media_id
		WHERE p.id = $1`, postColumns)
	return s.scanPost(s.pool.QueryRow(ctx, q, id))
}

func (s *Store) CreatePost(ctx context.Context, in PostInput) (*models.Post, error) {
	slug := in.Slug
	if strings.TrimSpace(slug) == "" {
		slug = Slugify(in.Title)
	} else {
		slug = Slugify(slug)
	}
	if in.Status == "" {
		in.Status = models.StatusDraft
	}
	// Publishing without an explicit date means "now".
	if in.Status == models.StatusPublished && in.PublishedAt == nil {
		now := time.Now().UTC()
		in.PublishedAt = &now
	}
	if in.Tags == nil {
		in.Tags = []string{}
	}

	var id uuid.UUID
	err := s.pool.QueryRow(ctx, `
		INSERT INTO posts (slug, title, summary, body_markdown, cover_media_id, tags, status, reading_minutes, published_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id`,
		slug, in.Title, in.Summary, in.BodyMarkdown, in.CoverMediaID, in.Tags,
		in.Status, ReadingMinutes(in.BodyMarkdown), in.PublishedAt,
	).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	return s.GetPost(ctx, id)
}

func (s *Store) UpdatePost(ctx context.Context, id uuid.UUID, in PostInput) (*models.Post, error) {
	slug := in.Slug
	if strings.TrimSpace(slug) == "" {
		slug = Slugify(in.Title)
	} else {
		slug = Slugify(slug)
	}
	if in.Tags == nil {
		in.Tags = []string{}
	}
	if in.Status == models.StatusPublished && in.PublishedAt == nil {
		now := time.Now().UTC()
		in.PublishedAt = &now
	}

	tag, err := s.pool.Exec(ctx, `
		UPDATE posts SET
			slug = $2, title = $3, summary = $4, body_markdown = $5, cover_media_id = $6,
			tags = $7, status = $8, reading_minutes = $9, published_at = $10, updated_at = now()
		WHERE id = $1`,
		id, slug, in.Title, in.Summary, in.BodyMarkdown, in.CoverMediaID, in.Tags,
		in.Status, ReadingMinutes(in.BodyMarkdown), in.PublishedAt,
	)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetPost(ctx, id)
}

func (s *Store) DeletePost(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM posts WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListTags returns every tag used by a published post with its post count,
// most used first. Powers the blog tag filter.
func (s *Store) ListTags(ctx context.Context) ([]TagCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t AS tag, count(*) AS n
		FROM posts p, unnest(p.tags) AS t
		WHERE p.status = 'published' AND p.published_at <= now()
		GROUP BY t ORDER BY n DESC, t ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TagCount{}
	for rows.Next() {
		var tc TagCount
		if err := rows.Scan(&tc.Tag, &tc.Count); err != nil {
			return nil, err
		}
		out = append(out, tc)
	}
	return out, rows.Err()
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}
