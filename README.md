# Portfolio

A personal site with a custom CMS: project demos, a CV, an about page, and a
blog - all editable from `/admin`, no third-party CMS involved.

- **`api/`** - Go 1.26 HTTP API (chi, pgx, Postgres). Owns all content, auth and
  uploads.
- **`web/`** - Next.js 16 App Router frontend (TypeScript, Tailwind v4). Public
  site plus the CMS UI.
- **`docs/`** - how everything works and how to change it.

Everything runs under `docker compose`: web on `:3000`, api on `:8080`,
Postgres internal only.

## Quick start

```bash
cp .env.example .env
# edit .env: set JWT_SECRET (openssl rand -base64 48) and POSTGRES_PASSWORD

docker compose up -d --build
docker compose exec api adminctl create-user -email you@example.com -name "Your Name"
docker compose exec api adminctl seed      # optional demo content
```

Then open <http://localhost:3000> and sign in at
<http://localhost:3000/admin/login>.

For working on the code without rebuilding images every time, see
[docs/development.md](docs/development.md).

## What is where

| Path | What it holds |
| --- | --- |
| `api/cmd/server` | The API binary's entrypoint |
| `api/cmd/adminctl` | Operator CLI: create users, migrate, seed |
| `api/internal/httpapi` | Routing, handlers, middleware |
| `api/internal/store` | Every SQL query in the project |
| `api/internal/migrations` | Append-only `*.sql` schema history |
| `api/internal/auth` | argon2id passwords, JWT session cookie |
| `api/internal/media` | Upload storage (local disk today, S3-ready) |
| `web/app/[lang]` | The public pages, once per locale (`/en`, `/da`) |
| `web/lib/i18n` | Locale config, UI dictionaries, locale helpers |
| `web/app/admin` | The CMS |
| `web/lib/api` | Typed API client, split server/browser |
| `web/components` | Shared UI, including the demo renderers |
| `docker-stack.yml` | Production stack for Swarm + Traefik |
| `.github/workflows` | Checks on every PR, deploy on green main |
| `scripts/server-bootstrap.sh` | One-time server setup |

## Documentation

| Document | Read it when |
| --- | --- |
| [architecture.md](docs/architecture.md) | You want the shape of the system and why it is split this way |
| [development.md](docs/development.md) | You are setting up to work on it locally |
| [configuration.md](docs/configuration.md) | You need to know what an environment variable does |
| [api.md](docs/api.md) | You are calling or changing an endpoint |
| [database.md](docs/database.md) | You are changing the schema |
| [frontend.md](docs/frontend.md) | You are adding a page or changing rendering/caching |
| [design.md](docs/design.md) | You are writing UI and want it to match |
| [cms.md](docs/cms.md) | You are publishing content, not writing code |
| [deployment.md](docs/deployment.md) | You are putting it on a server |
| [ci-cd.md](docs/ci-cd.md) | You want to know how a branch becomes a deploy |
| [i18n.md](docs/i18n.md) | You are touching anything that has a Danish version |
| [recipes.md](docs/recipes.md) | You want a step-by-step for a common change |

## Common commands

```bash
# api
cd api && go test ./... && go vet ./...
docker compose exec api adminctl migrate
docker compose exec api adminctl set-password -email you@example.com

# web
cd web && npm run dev          # needs the api running on :8080
cd web && npm run typecheck && npm run lint

# stack
docker compose logs -f api
docker compose up -d --build web
docker compose down            # add -v to also drop the database and uploads
```
