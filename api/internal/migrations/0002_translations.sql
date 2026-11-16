-- 0002_translations.sql
-- Danish (and any later) translations of content.
--
-- English is the default locale and stays in the existing columns. Every other
-- locale lives in one JSONB column per table, keyed by locale code:
--
--   {"da": {"title": "...", "summary": "...", "body_markdown": "..."}}
--
-- A missing locale, or an empty field inside one, falls back to English when
-- the public API serves it. See store/i18n.go.
--
-- Settings blobs need no schema change: they carry the same shape under a
-- "translations" key inside their own JSON value.

ALTER TABLE posts      ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE projects   ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cv_entries ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb;
