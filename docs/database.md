# Database

Postgres 17. The schema lives in `api/internal/migrations/*.sql`, embedded into
the binary and applied at startup.

## Migrations

`database.Migrate` creates `schema_migrations`, then applies every embedded
`*.sql` file not listed there, in lexical filename order, each in its own
transaction.

**Migrations are append-only.** Never edit a file that has already run - the
runner tracks filenames, not content, so an edit is silently ignored on a
database that already applied it, and then two environments disagree about what
the schema is. Add `0002_...sql` instead.

Naming: `NNNN_short_description.sql`, zero-padded to four digits.

```bash
# apply manually (the server does this at boot anyway)
docker compose exec api adminctl migrate

# what has been applied
docker compose exec postgres psql -U portfolio -d portfolio \
  -c 'select * from schema_migrations order by name'
```

There is no down-migration mechanism. For a single-author site the honest
recovery path is "restore the backup", and reversible migrations would be a
machine for creating false confidence.

## Tables

### `users`
One row, normally. `password_hash` is argon2id in PHC format. Created by
`adminctl create-user`; nothing in the HTTP API creates users.

### `media`
`storage_key` is opaque to the application - only `internal/media` interprets
it. `width`/`height` are nullable because not every upload is a decodable
raster image.

### `posts`
| Column | Notes |
| --- | --- |
| `slug` | Unique. Changing it breaks existing links. |
| `tags` | `TEXT[]` with a GIN index; filtering uses `= ANY(tags)` |
| `status` | `content_status` enum: `draft` \| `published` |
| `published_at` | Nullable. Public reads require non-null and `<= now()`, so a future date is a scheduled post. |
| `reading_minutes` | Computed on write at 220 wpm |
| `cover_media_id` | `ON DELETE SET NULL` |

Indexed on `(status, published_at DESC)` for the list query.

### `projects`
| Column | Notes |
| --- | --- |
| `demo_type` | `demo_type` enum: `none` \| `iframe` \| `video` \| `asciinema` \| `gallery` |
| `demo_url` | Meaning depends on `demo_type`; see [recipes.md](recipes.md#add-a-new-demo-type) |
| `tech` | `TEXT[]` |
| `featured` | Drives placement on the home page |
| `sort_order` | Lower first, after featured |

`project_media` is the ordered gallery join table: `(project_id, media_id,
sort_order)`, cascading on both sides. The store replaces it wholesale on
update, inside the same transaction as the project row.

### `cv_entries`
Structured rather than a PDF blob so the CV stays editable and renders as HTML.
`kind` groups it into page sections; `is_current` with a null `end_date` renders
as "now". `highlights` is a `TEXT[]` of short bullets.

### `settings`
`key TEXT PRIMARY KEY, value JSONB`. Three rows, seeded by the first migration:

```
site     {title, tagline, description, email, location}
about    {heading, body_markdown, avatar_media_id}
socials  {links: [{label, url}]}
```

Deliberately schemaless: these are page copy, not content records, and giving
them columns would mean a migration every time a line of text moves.

## Scheduled posts

Setting `published_at` to a future timestamp with `status = published` hides the
post until that moment, because every public query carries
`published_at <= now()`. Nothing polls - the post simply starts matching. The
frontend caches for 60 seconds, so it can appear up to a minute late.

## Backups

Everything that matters is the database plus the uploads volume.

```bash
# database
docker compose exec -T postgres pg_dump -U portfolio portfolio | gzip > backup-$(date +%F).sql.gz

# uploads
docker run --rm -v portfolio_uploads:/data -v "$PWD:/out" alpine \
  tar czf /out/uploads-$(date +%F).tar.gz -C /data .
```

Restore:

```bash
gunzip -c backup-2026-11-12.sql.gz | docker compose exec -T postgres psql -U portfolio -d portfolio
docker run --rm -v portfolio_uploads:/data -v "$PWD:/in" alpine \
  tar xzf /in/uploads-2026-11-12.tar.gz -C /data
```

A database restored without its uploads leaves broken images; keep the two
snapshots together.

## Conventions for new tables

- UUID primary keys, `DEFAULT gen_random_uuid()`.
- `created_at` / `updated_at` as `TIMESTAMPTZ NOT NULL DEFAULT now()`; set
  `updated_at = now()` explicitly in UPDATE statements.
- Enums over free text for closed sets - Postgres then rejects a typo that the
  application layer missed.
- Arrays over join tables for simple unordered labels (tags, tech); join tables
  when order or extra columns matter (gallery).
