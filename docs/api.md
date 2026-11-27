# HTTP API

Base path `/api/v1`. Everything is JSON except `/media/*` and `/api/v1/feed.xml`.

## Conventions

**Errors** always look like this:

```json
{ "error": { "code": "not_found", "message": "post not found" } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `bad_request` | Malformed JSON, bad UUID, unknown settings key |
| 401 | `unauthorized` / `invalid_credentials` | Missing or invalid session; bad login |
| 404 | `not_found` | No such record, or it is a draft and you are not signed in |
| 409 | `conflict` | Slug already taken |
| 415 | `unsupported_type` | Upload content type not allowlisted |
| 422 | `validation` | Required field missing, bad enum value |
| 429 | `rate_limited` | More than 10 login attempts in 15 minutes |
| 500 | `internal` | Logged server-side; the message is deliberately vague |

**Collections** are wrapped:

```json
{ "items": [ ... ], "total": 42, "limit": 20, "offset": 0 }
```

`/tags`, `/tech` and `/cv` return the simpler `{ "items": [...] }` because they
are never paginated.

**Unknown JSON fields are rejected** (`DisallowUnknownFields`), so a typo in a
request body is an error rather than a silent no-op.

**Languages.** Every public endpoint takes `?lang=en|da`. Leaving it out means
`en`; any other value is a 400. The response is already localized: Danish
fields are overlaid on the English ones, with English as the fallback for
anything untranslated, and there is no `translations` field. Posts and projects
carry `locale`, the language their body was actually served in. Admin
endpoints ignore `lang` and return records raw, with `translations`. Details in
[i18n.md](i18n.md).

## Public endpoints

No authentication. Only published content is visible.

| Method | Path | Query | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/posts` | `tag`, `q`, `limit` (≤100, default 20), `offset` | Posts, newest first |
| GET | `/api/v1/posts/{slug}` | - | One post |
| GET | `/api/v1/tags` | - | `{tag, count}` for published posts |
| GET | `/api/v1/projects` | `featured=true`, `tech`, `limit`, `offset` | Featured first, then `sort_order`, then newest |
| GET | `/api/v1/projects/{slug}` | - | One project, gallery included |
| GET | `/api/v1/tech` | - | `{tag, count}` across published projects |
| GET | `/api/v1/cv` | `kind` | CV entries, grouped and ordered |
| GET | `/api/v1/settings` | - | `{site, about, socials}` |
| GET | `/api/v1/feed.xml` | `lang` | RSS 2.0, 50 most recent posts, linking to that locale's pages |
| GET | `/healthz` | - | `{"status":"ok"}`, or 503 if the database is down |
| GET | `/media/{key}` | - | An uploaded file, `immutable` cache header |

All of the above except `/tags`, `/tech`, `/healthz` and `/media` also take
`lang` (see Conventions).

`q` matches title, summary and body, and their translations, case-insensitively.

## Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | `{email, password}` | Sets the session cookie. Rate limited. |
| POST | `/api/v1/auth/logout` | - | Clears the cookie. 204. |
| GET | `/api/v1/auth/me` | - | The signed-in user, or 401 |

Unknown email and wrong password both return the same 401, so the endpoint does
not disclose which accounts exist.

## Admin endpoints

All of `/api/v1/admin/*` requires the session cookie. These see drafts.

### Posts

| Method | Path |
| --- | --- |
| GET | `/api/v1/admin/posts` |
| POST | `/api/v1/admin/posts` |
| GET | `/api/v1/admin/posts/{id}` |
| PUT | `/api/v1/admin/posts/{id}` |
| DELETE | `/api/v1/admin/posts/{id}` |

Body for POST/PUT:

```json
{
  "slug": "",
  "title": "Hello, world",
  "summary": "One or two sentences.",
  "body_markdown": "## Heading\n\nText.",
  "cover_media_id": null,
  "tags": ["go", "postgres"],
  "status": "draft",
  "published_at": null
}
```

- `slug` empty → derived from `title`.
- `status: "published"` with `published_at: null` → published now.
- `reading_minutes` is computed server-side; do not send it.
- PUT replaces the whole record. There is no PATCH.

### Projects

Same five routes under `/api/v1/admin/projects`. Body:

```json
{
  "slug": "",
  "title": "todo-tui",
  "tagline": "A keyboard-driven todo list for your terminal.",
  "body_markdown": "## The problem\n\n…",
  "tech": ["Go", "Bubble Tea"],
  "repo_url": "https://github.com/you/todo-tui",
  "live_url": "",
  "demo_type": "asciinema",
  "demo_url": "https://asciinema.org/a/123456",
  "cover_media_id": null,
  "gallery_media_ids": ["<media-uuid>", "<media-uuid>"],
  "featured": true,
  "status": "published",
  "sort_order": 0
}
```

`demo_type` is one of `none`, `iframe`, `video`, `asciinema`, `gallery`.
`demo_url` is required for `iframe`, `video` and `asciinema` - the API returns
422 otherwise, because a demo frame with no source renders as an empty box.
`gallery_media_ids` replaces the whole gallery in the order given.

### CV

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/admin/cv` | Same data as the public route |
| POST | `/api/v1/admin/cv` | Create |
| PUT | `/api/v1/admin/cv/{id}` | Replace |
| PUT | `/api/v1/admin/cv/reorder` | `{"ids": [...]}` - rewrites `sort_order` to match the array order |
| DELETE | `/api/v1/admin/cv/{id}` | |

`kind` is one of `experience`, `education`, `skill`, `certification`, `other`.
Dates are `YYYY-MM-DD` strings or null; `is_current: true` renders as "now".
A `skill` entry is one category: `title` is its label and `highlights` its
skills; the other fields are unused.

### Media

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/admin/media` | `limit` (≤200), `offset` |
| POST | `/api/v1/admin/media` | `multipart/form-data`: `file` (required), `alt` |
| PATCH | `/api/v1/admin/media/{id}` | `{"alt_text": "..."}` |
| DELETE | `/api/v1/admin/media/{id}` | Removes the row and the file |

The content type is sniffed from the bytes, not taken from the client, and must
be in `media.AllowedContentTypes`. Image dimensions are decoded on upload where
possible. Deleting media that a post or project uses is allowed: covers become
null, gallery entries disappear.

### Settings

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/admin/settings` | All three blobs, raw, `translations` included |
| PUT | `/api/v1/admin/settings/{key}` | `key` ∈ `site`, `about`, `socials`. Body is the whole blob, `translations` included. |

Posts, projects and CV entries take a `translations` object in their create and
update bodies, for example `{"da": {"title": "...", "summary": "", "body_markdown": "..."}}`.
It replaces the stored translations wholesale: leaving it out clears them. Only
`da` is accepted as a key (422 otherwise); English is the base fields.

Unknown keys are rejected so the table cannot become a junk drawer. To add one,
extend `allowedSettingKeys` in `handlers_settings.go` and document it in
[cms.md](cms.md).

## Next.js routes

Served by the frontend, not the API:

| Path | Purpose |
| --- | --- |
| `POST /api/revalidate` | Purges Next.js cache tags after a CMS save. Authorises by forwarding the session cookie to `/api/v1/auth/me`. Accepts `posts`, `projects`, `cv`, `settings`. |
| `GET /en/feed.xml`, `GET /da/feed.xml` | Proxy the API's RSS per locale so the feed lives on the site's domain |
| `GET /feed.xml` | The English feed, kept for subscriptions made before translations |
| `GET /sitemap.xml`, `GET /robots.txt` | Generated from the API; `/admin` is disallowed |
