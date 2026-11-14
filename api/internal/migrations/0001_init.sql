-- 0001_init.sql
-- Core schema: users, media, posts, projects, cv entries, settings.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users: there is normally exactly one (you). Created via `adminctl create-user`.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- media: every uploaded file. `storage_key` is opaque to the rest of the app;
-- the storage backend (local disk or S3) resolves it to bytes.
-- ---------------------------------------------------------------------------
CREATE TABLE media (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key  TEXT NOT NULL UNIQUE,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes   BIGINT NOT NULL,
    width        INT,
    height       INT,
    alt_text     TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- posts: blog entries written in Markdown.
-- status drives public visibility; published_at drives ordering.
-- ---------------------------------------------------------------------------
CREATE TYPE content_status AS ENUM ('draft', 'published');

CREATE TABLE posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    summary        TEXT NOT NULL DEFAULT '',
    body_markdown  TEXT NOT NULL DEFAULT '',
    cover_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    tags           TEXT[] NOT NULL DEFAULT '{}',
    status         content_status NOT NULL DEFAULT 'draft',
    reading_minutes INT NOT NULL DEFAULT 0,
    published_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_status_published_at_idx ON posts (status, published_at DESC NULLS LAST);
CREATE INDEX posts_tags_idx ON posts USING GIN (tags);

-- ---------------------------------------------------------------------------
-- projects: portfolio entries. `demo_type` selects which renderer the frontend
-- uses on the project page; `demo_url` is interpreted per type:
--   iframe    -> URL embedded in a sandboxed iframe
--   video     -> URL of an mp4/webm (looped, muted, autoplay)
--   asciinema -> asciinema cast id or .cast URL
--   gallery   -> ignored; the gallery media array is shown instead
--   none      -> no demo block
-- ---------------------------------------------------------------------------
CREATE TYPE demo_type AS ENUM ('none', 'iframe', 'video', 'asciinema', 'gallery');

CREATE TABLE projects (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    tagline        TEXT NOT NULL DEFAULT '',
    body_markdown  TEXT NOT NULL DEFAULT '',
    tech           TEXT[] NOT NULL DEFAULT '{}',
    repo_url       TEXT NOT NULL DEFAULT '',
    live_url       TEXT NOT NULL DEFAULT '',
    demo_type      demo_type NOT NULL DEFAULT 'none',
    demo_url       TEXT NOT NULL DEFAULT '',
    cover_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    featured       BOOLEAN NOT NULL DEFAULT false,
    status         content_status NOT NULL DEFAULT 'draft',
    sort_order     INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_status_sort_idx ON projects (status, sort_order, created_at DESC);

-- ordered gallery attached to a project
CREATE TABLE project_media (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    media_id   UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, media_id)
);

-- ---------------------------------------------------------------------------
-- cv_entries: structured CV so the page stays editable from the CMS instead of
-- being a PDF blob. `kind` groups entries into sections.
-- ---------------------------------------------------------------------------
CREATE TYPE cv_kind AS ENUM ('experience', 'education', 'skill', 'certification', 'other');

CREATE TABLE cv_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        cv_kind NOT NULL DEFAULT 'experience',
    title       TEXT NOT NULL,
    organization TEXT NOT NULL DEFAULT '',
    location    TEXT NOT NULL DEFAULT '',
    start_date  DATE,
    end_date    DATE,                       -- NULL + is_current=true => "Present"
    is_current  BOOLEAN NOT NULL DEFAULT false,
    description_markdown TEXT NOT NULL DEFAULT '',
    highlights  TEXT[] NOT NULL DEFAULT '{}',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cv_entries_kind_sort_idx ON cv_entries (kind, sort_order, start_date DESC);

-- ---------------------------------------------------------------------------
-- settings: single-row-per-key JSON store for everything that is "the site
-- itself" rather than a content item - about page, socials, SEO defaults.
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('site', '{"title":"Portfolio","tagline":"Developer","description":"","email":"","location":""}'::jsonb),
  ('about', '{"heading":"About me","body_markdown":"","avatar_media_id":null}'::jsonb),
  ('socials', '{"links":[]}'::jsonb);
