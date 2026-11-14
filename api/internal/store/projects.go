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

type ProjectInput struct {
	Slug         string          `json:"slug"`
	Title        string          `json:"title"`
	Tagline      string          `json:"tagline"`
	BodyMarkdown string          `json:"body_markdown"`
	Tech         []string        `json:"tech"`
	RepoURL      string          `json:"repo_url"`
	LiveURL      string          `json:"live_url"`
	DemoType     models.DemoType `json:"demo_type"`
	DemoURL      string          `json:"demo_url"`
	CoverMediaID *uuid.UUID      `json:"cover_media_id"`
	// GalleryMediaIDs replaces the whole gallery, in the order given.
	GalleryMediaIDs []uuid.UUID   `json:"gallery_media_ids"`
	Featured        bool          `json:"featured"`
	Status          models.Status `json:"status"`
	SortOrder       int           `json:"sort_order"`
}

type ProjectFilter struct {
	IncludeDrafts bool
	FeaturedOnly  bool
	Tech          string
	Limit         int
	Offset        int
}

const projectColumns = `
	p.id, p.slug, p.title, p.tagline, p.body_markdown, p.tech, p.repo_url, p.live_url,
	p.demo_type, p.demo_url, p.cover_media_id, p.featured, p.status, p.sort_order,
	p.created_at, p.updated_at,
	m.id, m.storage_key, m.filename, m.content_type, m.size_bytes, m.width, m.height, m.alt_text, m.created_at`

func (s *Store) scanProject(row pgx.Row) (*models.Project, error) {
	var p models.Project
	var mID *uuid.UUID
	var mKey, mFilename, mType, mAlt *string
	var mSize *int64
	var mW, mH *int
	var mCreated *time.Time

	err := row.Scan(
		&p.ID, &p.Slug, &p.Title, &p.Tagline, &p.BodyMarkdown, &p.Tech, &p.RepoURL, &p.LiveURL,
		&p.DemoType, &p.DemoURL, &p.CoverMediaID, &p.Featured, &p.Status, &p.SortOrder,
		&p.CreatedAt, &p.UpdatedAt,
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
	p.Gallery = []models.Media{}
	return &p, nil
}

// loadGalleries fills the Gallery field for the given projects in one query, so
// a list endpoint stays at two round trips instead of N+1.
func (s *Store) loadGalleries(ctx context.Context, projects []models.Project) error {
	if len(projects) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, len(projects))
	index := make(map[uuid.UUID]int, len(projects))
	for i, p := range projects {
		ids[i] = p.ID
		index[p.ID] = i
	}
	rows, err := s.pool.Query(ctx, `
		SELECT pm.project_id, m.id, m.storage_key, m.filename, m.content_type,
		       m.size_bytes, m.width, m.height, m.alt_text, m.created_at
		FROM project_media pm
		JOIN media m ON m.id = pm.media_id
		WHERE pm.project_id = ANY($1)
		ORDER BY pm.sort_order ASC`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var pid uuid.UUID
		var m models.Media
		if err := rows.Scan(&pid, &m.ID, &m.StorageKey, &m.Filename, &m.ContentType,
			&m.SizeBytes, &m.Width, &m.Height, &m.AltText, &m.CreatedAt); err != nil {
			return err
		}
		m.URL = s.mediaURL(m.StorageKey)
		if i, ok := index[pid]; ok {
			projects[i].Gallery = append(projects[i].Gallery, m)
		}
	}
	return rows.Err()
}

func (s *Store) ListProjects(ctx context.Context, f ProjectFilter) ([]models.Project, int, error) {
	where := []string{}
	args := []any{}

	if !f.IncludeDrafts {
		where = append(where, "p.status = 'published'")
	}
	if f.FeaturedOnly {
		where = append(where, "p.featured = true")
	}
	if f.Tech != "" {
		args = append(args, f.Tech)
		where = append(where, fmt.Sprintf("$%d = ANY(p.tech)", len(args)))
	}
	clause := ""
	if len(where) > 0 {
		clause = "WHERE " + strings.Join(where, " AND ")
	}

	var total int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM projects p `+clause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	args = append(args, limit, f.Offset)
	q := fmt.Sprintf(`
		SELECT %s FROM projects p
		LEFT JOIN media m ON m.id = p.cover_media_id
		%s
		ORDER BY p.featured DESC, p.sort_order ASC, p.created_at DESC
		LIMIT $%d OFFSET $%d`, projectColumns, clause, len(args)-1, len(args))

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	out := []models.Project{}
	for rows.Next() {
		p, err := s.scanProject(rows)
		if err != nil {
			rows.Close()
			return nil, 0, err
		}
		out = append(out, *p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if err := s.loadGalleries(ctx, out); err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

func (s *Store) getProjectBy(ctx context.Context, cond string, arg any, includeDrafts bool) (*models.Project, error) {
	q := fmt.Sprintf(`
		SELECT %s FROM projects p
		LEFT JOIN media m ON m.id = p.cover_media_id
		WHERE %s`, projectColumns, cond)
	if !includeDrafts {
		q += ` AND p.status = 'published'`
	}
	p, err := s.scanProject(s.pool.QueryRow(ctx, q, arg))
	if err != nil {
		return nil, err
	}
	list := []models.Project{*p}
	if err := s.loadGalleries(ctx, list); err != nil {
		return nil, err
	}
	return &list[0], nil
}

func (s *Store) GetProjectBySlug(ctx context.Context, slug string, includeDrafts bool) (*models.Project, error) {
	return s.getProjectBy(ctx, "p.slug = $1", slug, includeDrafts)
}

func (s *Store) GetProject(ctx context.Context, id uuid.UUID) (*models.Project, error) {
	return s.getProjectBy(ctx, "p.id = $1", id, true)
}

func (s *Store) CreateProject(ctx context.Context, in ProjectInput) (*models.Project, error) {
	in.normalise()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) // no-op once Commit has succeeded

	var id uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO projects (slug, title, tagline, body_markdown, tech, repo_url, live_url,
		                      demo_type, demo_url, cover_media_id, featured, status, sort_order)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		RETURNING id`,
		in.Slug, in.Title, in.Tagline, in.BodyMarkdown, in.Tech, in.RepoURL, in.LiveURL,
		in.DemoType, in.DemoURL, in.CoverMediaID, in.Featured, in.Status, in.SortOrder,
	).Scan(&id)
	if err != nil {
		return nil, mapErr(err)
	}
	if err := replaceGallery(ctx, tx, id, in.GalleryMediaIDs); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetProject(ctx, id)
}

func (s *Store) UpdateProject(ctx context.Context, id uuid.UUID, in ProjectInput) (*models.Project, error) {
	in.normalise()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE projects SET
			slug=$2, title=$3, tagline=$4, body_markdown=$5, tech=$6, repo_url=$7, live_url=$8,
			demo_type=$9, demo_url=$10, cover_media_id=$11, featured=$12, status=$13,
			sort_order=$14, updated_at=now()
		WHERE id=$1`,
		id, in.Slug, in.Title, in.Tagline, in.BodyMarkdown, in.Tech, in.RepoURL, in.LiveURL,
		in.DemoType, in.DemoURL, in.CoverMediaID, in.Featured, in.Status, in.SortOrder,
	)
	if err != nil {
		return nil, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	if err := replaceGallery(ctx, tx, id, in.GalleryMediaIDs); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetProject(ctx, id)
}

func (s *Store) DeleteProject(ctx context.Context, id uuid.UUID) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func replaceGallery(ctx context.Context, tx pgx.Tx, projectID uuid.UUID, mediaIDs []uuid.UUID) error {
	if _, err := tx.Exec(ctx, `DELETE FROM project_media WHERE project_id = $1`, projectID); err != nil {
		return err
	}
	for i, mid := range mediaIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO project_media (project_id, media_id, sort_order) VALUES ($1,$2,$3)
			 ON CONFLICT (project_id, media_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
			projectID, mid, i); err != nil {
			return mapErr(err)
		}
	}
	return nil
}

// normalise fills in defaults so partially specified input is still valid.
func (in *ProjectInput) normalise() {
	if strings.TrimSpace(in.Slug) == "" {
		in.Slug = Slugify(in.Title)
	} else {
		in.Slug = Slugify(in.Slug)
	}
	if in.Tech == nil {
		in.Tech = []string{}
	}
	if in.GalleryMediaIDs == nil {
		in.GalleryMediaIDs = []uuid.UUID{}
	}
	if in.Status == "" {
		in.Status = models.StatusDraft
	}
	if in.DemoType == "" {
		in.DemoType = models.DemoNone
	}
}

// ListTech returns the distinct tech tags used by published projects.
func (s *Store) ListTech(ctx context.Context) ([]TagCount, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT t AS tag, count(*) AS n
		FROM projects p, unnest(p.tech) AS t
		WHERE p.status = 'published'
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
