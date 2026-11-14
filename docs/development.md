# Development

## What you need

- Docker (for Postgres, at minimum)
- Go 1.26+
- Node 22+

## The fast loop

Run Postgres in Docker, the API and the frontend on the host, so both reload
quickly.

```bash
# 1. Postgres only
docker compose up -d postgres

# 2. API (new terminal, from api/)
export DATABASE_URL='postgres://portfolio:<POSTGRES_PASSWORD>@localhost:5432/portfolio?sslmode=disable'
export JWT_SECRET="$(openssl rand -base64 48)"
export STORAGE_LOCAL_DIR=../data/uploads
go run ./cmd/server

# 3. Frontend (new terminal, from web/)
npm install
npm run dev
```

> Postgres is only published on `localhost:5432` if you add a `ports:` entry to
> the `postgres` service in `docker-compose.yml`. It is intentionally not
> published by default, so add it in a `docker-compose.override.yml` rather than
> editing the committed file:
>
> ```yaml
> services:
>   postgres:
>     ports: ["5432:5432"]
> ```

Migrations run automatically when the API starts.

### First-run accounts

```bash
cd api
export PORTFOLIO_PASSWORD='something at least ten characters'
go run ./cmd/adminctl create-user -email you@example.com -name "Your Name"
go run ./cmd/adminctl seed          # optional demo content
```

`PORTFOLIO_PASSWORD` is read from the environment so the password never lands in
shell history. Leave it unset and the CLI prompts on stdin instead.

## The whole-stack loop

```bash
docker compose up -d --build
docker compose logs -f api web
```

Rebuild one service after a change:

```bash
docker compose up -d --build api
```

Note that `NEXT_PUBLIC_*` values are baked into the browser bundle at image
build time. Changing `PUBLIC_API_URL` in `.env` means rebuilding `web`, not just
restarting it.

## Checks before committing

```bash
cd api && gofmt -l . && go vet ./... && go test ./...
cd web && npm run typecheck && npm run lint && npm run build
```

`gofmt -l .` should print nothing. There is no CI configured; these four
commands are the gate.

## Testing

Go tests cover the pure logic - slugs, reading time, password hashing:

```bash
cd api && go test ./...
```

There are deliberately no database-backed tests yet. If you add them, use a
throwaway Postgres container and the real migrations rather than mocks: the
store layer is thin, and what it needs proving is that the SQL is right.

## Useful one-liners

```bash
# psql into the compose database
docker compose exec postgres psql -U portfolio -d portfolio

# what did the API just do
docker compose logs -f api | grep '"level":"ERROR"'

# reset everything, including content and uploads
docker compose down -v && docker compose up -d --build

# log in from the command line and keep the cookie
curl -s -c cookies.txt -X POST localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}'
curl -s -b cookies.txt localhost:8080/api/v1/admin/posts
```

## Troubleshooting

**The CMS logs me straight back out.** The session cookie is `SameSite=Lax`,
which means the site and the API must be same-site. `localhost:3000` and
`localhost:8080` are (ports do not matter); `yourdomain.com` and
`api.yourdomain.com` are. Unrelated domains are not - see
[configuration.md](configuration.md#cookies-and-origins).

**Uploads 401 but reads work.** The upload goes to the API directly from the
browser; check that `NEXT_PUBLIC_API_URL` points at the API's *public* URL, not
the internal compose hostname.

**A published change does not show on the site.** The CMS purges the cache after
a successful save. If the purge failed (look for a failed `/api/revalidate`
request), the change appears on the next cache expiry, 60 seconds later.

**`next build` succeeds without the API running.** That is intentional: the
public pages fall back to empty content at build time and render per request.
See [frontend.md](frontend.md#caching).
