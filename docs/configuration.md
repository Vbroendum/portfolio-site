# Configuration

Everything is environment variables. There is no config file in either service.

## API (`api/internal/config/config.go`)

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | - (**required**) | libpq connection string |
| `JWT_SECRET` | - (**required**, ≥32 bytes) | Signs session cookies. Rotating it logs everyone out. |
| `API_ADDR` | `:8080` | Listen address |
| `APP_ENV` | `development` | `production` raises the log level to info |
| `SESSION_TTL` | `168h` | How long a login lasts |
| `COOKIE_SECURE` | `false` | Set `true` once you serve HTTPS |
| `COOKIE_DOMAIN` | empty | Only needed when the site and API are on different subdomains |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated browser origins allowed to send credentials |
| `STORAGE_DRIVER` | `local` | `local` or `s3` (s3 not implemented yet) |
| `STORAGE_LOCAL_DIR` | `./data/uploads` | Where the local driver writes |
| `PUBLIC_MEDIA_BASE_URL` | `http://localhost:8080/media` | Prefix used to build media URLs returned by the API |
| `PUBLIC_SITE_URL` | `http://localhost:3000` | Used for links in the RSS feed |
| `MAX_UPLOAD_BYTES` | `26214400` (25 MiB) | Per-file upload cap |

The API refuses to start if `DATABASE_URL` is missing or `JWT_SECRET` is shorter
than 32 bytes - a weak signing key is a silent security hole, so it fails loudly
instead.

## Frontend (`web/`)

| Variable | Where it is read | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Browser **and** build | The API URL the browser calls. Baked into the bundle at build time. |
| `API_INTERNAL_URL` | Server only | The API URL Server Components call. In compose this is `http://api:8080`. |
| `NEXT_PUBLIC_SITE_URL` | Build + server | Canonical site origin for metadata, sitemap and robots |

`NEXT_PUBLIC_*` values are inlined into the client bundle during `next build`.
Changing them requires a rebuild, not just a restart.

## Compose-level (`.env`)

`docker-compose.yml` reads `.env` and derives the service variables from it.

| Variable | Used for |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | The database, and the `DATABASE_URL` built from them |
| `JWT_SECRET` | Passed to the API |
| `PUBLIC_SITE_URL` | Site origin; also becomes the API's `CORS_ORIGINS` |
| `PUBLIC_API_URL` | API origin; also becomes `PUBLIC_MEDIA_BASE_URL` |
| `COOKIE_SECURE`, `COOKIE_DOMAIN`, `SESSION_TTL` | Session behaviour |
| `WEB_PORT`, `API_PORT` | Host ports to publish |
| `MAX_UPLOAD_BYTES` | Upload cap |

## Cookies and origins

The session cookie is `HttpOnly`, `SameSite=Lax`, scoped to the API's host
unless `COOKIE_DOMAIN` says otherwise. The browser sends it on cross-origin
requests only when the two origins are *same-site* - the same registrable
domain, ports ignored.

| Site | API | Works? | What to set |
| --- | --- | --- | --- |
| `localhost:3000` | `localhost:8080` | yes | nothing |
| `yourdomain.com` | `api.yourdomain.com` | yes | `COOKIE_DOMAIN=.yourdomain.com` |
| `yourdomain.com` | `yourdomain.com/api` (one proxy) | yes | nothing |
| `yourdomain.com` | `someotherhost.net` | **no** | Put them behind one domain instead |

If you genuinely must split across domains, the cookie needs `SameSite=None;
Secure`, which also means the API becomes a CSRF target and needs a token. The
single-domain layouts above avoid that entirely - prefer them.

## Generating secrets

```bash
openssl rand -base64 48     # JWT_SECRET
openssl rand -hex 16        # POSTGRES_PASSWORD
```

`.env` is gitignored. Keep a copy somewhere safe: losing `JWT_SECRET` only logs
you out, but losing `POSTGRES_PASSWORD` locks you out of your own backups.
