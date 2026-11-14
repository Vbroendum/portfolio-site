# Architecture

## The shape of it

```
                    browser
                       │
        ┌──────────────┴───────────────┐
        │                              │
   GET  │ pages                        │ /api/v1/admin/*  (session cookie)
        ▼                              ▼
┌────────────────┐   server-side  ┌──────────────────┐
│   web  :3000   │───────────────▶│    api  :8080    │
│   Next.js 16   │   fetch+tags   │   Go 1.26 / chi  │
│                │                │                  │
│  (site)  public│                │  /api/v1/...     │
│  /admin  CMS   │                │  /media/...      │
└────────────────┘                └────────┬─────────┘
                                           │
                                  ┌────────▼─────────┐   ┌──────────────┐
                                  │  Postgres 17     │   │ uploads vol  │
                                  └──────────────────┘   └──────────────┘
```

Two deployables, one database, one volume for uploaded files.

## Why a separate Go API

The frontend could have owned the database directly. It does not, because:

- **The content outlives the frontend.** If the site is rebuilt in something
  other than Next.js, the API, the schema and the CMS contract survive.
- **One clear security boundary.** Every write goes through `/api/v1/admin/*`,
  which is gated by one middleware. The Next.js layer never holds a database
  credential, so a bug in a React Server Component cannot reach Postgres.
- **The CV and blog are read far more than they are written.** A small Go
  process with a connection pool serves that profile on a tiny VPS without
  ceremony.

The cost is one extra hop and two deploy units. On a single-VPS setup where
both containers share a network, that hop is sub-millisecond.

## Request paths

**Public page.** Browser → Next.js. The Server Component calls
`lib/api/server.ts`, which fetches the Go API over the internal network with a
cache tag. Pages render per request; the API responses behind them are cached
and purged by tag. See [frontend.md](frontend.md#caching) for why that split.

**CMS write.** Browser → Go API directly, with the session cookie
(`lib/api/admin.ts`). Next.js is not in the path at all. After a successful
save the CMS calls `POST /api/revalidate` on the Next.js side, which verifies
the same cookie against the API and then purges the affected tags.

**Uploaded file.** Browser → `GET /media/<key>` on the API, served from disk
with a one-year immutable cache header. Keys contain a random component, so a
replaced file always has a new URL.

## Layers inside the API

```
cmd/server          wiring and lifecycle only
  └─ httpapi        routing, decoding, status codes, validation
       └─ store     every SQL statement; returns models
            └─ database   pool + migration runner
  └─ auth           password hashing, session cookie, RequireAuth
  └─ media          where bytes live (local disk / S3)
  └─ models         the types shared by store and httpapi, and the JSON contract
```

Two rules keep this honest:

1. **Handlers never write SQL.** If a handler needs a new query, it gets a new
   method on `store`.
2. **`store` never writes HTTP.** It returns `ErrNotFound` / `ErrConflict`, and
   `writeStoreErr` maps those to 404 / 409.

## Content model

| Entity | Public visibility | Notes |
| --- | --- | --- |
| `posts` | `status = published` and `published_at <= now()` | Markdown body, tags array, optional cover |
| `projects` | `status = published` | Demo type + URL, tech array, ordered gallery |
| `cv_entries` | always | Grouped by `kind`, ordered by `sort_order` |
| `media` | always | Rows point at storage keys |
| `settings` | always | Three JSON blobs: `site`, `about`, `socials` |
| `users` | never | Normally exactly one: you |

Drafts are invisible to every public endpoint - that filter lives in the store,
not in the handler, so a new endpoint cannot forget it.

## Auth model

A single-author site does not need roles, invitations or a session table:

- One user row, password hashed with argon2id (parameters embedded in the hash).
- Login issues a 7-day HS256 JWT in an `HttpOnly`, `SameSite=Lax` cookie.
- `RequireAuth` validates it on every `/api/v1/admin/*` request.
- There is no server-side session store, so "log out everywhere" means rotating
  `JWT_SECRET`.
- Login is rate limited to 10 attempts per IP per 15 minutes, in memory.

The in-memory rate limiter is the one piece that assumes a single API replica.
If you ever scale out, move it to Postgres or Redis.

## Media storage

`media.Storage` has three methods: `Put`, `Delete`, `Handler`. The local driver
writes to `/data/uploads/<year>/<month>/<random>-<name><ext>`.

To add S3: implement the interface in a new file in `internal/media`, add the
case to `media.New()`, and set `STORAGE_DRIVER=s3`. Nothing in `httpapi` or
`store` changes - they only ever see the opaque storage key.

Uploads are allowlisted by sniffed content type (`media.AllowedContentTypes`),
not by the client's claim, so the library cannot be turned into a file host.

## What is deliberately not here

- **No comments.** Nothing to moderate, nothing to spam.
- **No roles or multi-user support.** One author.
- **No rich-text editor.** The body is markdown in the database and markdown in
  the editor; a WYSIWYG layer would only add a lossy conversion step.
- **No raw HTML in markdown.** `rehype-raw` is not enabled.
- **No client-side data fetching on public pages.** They are server-rendered;
  the browser gets HTML.
