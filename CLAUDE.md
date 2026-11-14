# CLAUDE.md

Guidance for working in this repo.

## What this is

A personal portfolio site with a custom CMS. Go API (`api/`) owns all data,
auth and uploads; Next.js frontend (`web/`) renders the public site and the CMS
at `/admin`. Postgres. Everything runs under `docker compose`.

Full docs are in `docs/`. Start with `docs/architecture.md`.

## Commands

```bash
# checks (run all four before calling work done)
cd api && gofmt -l . && go vet ./... && go test ./...
cd web && npm run typecheck && npm run lint && npm run build

# stack
docker compose up -d --build
docker compose up -d --build api        # one service
docker compose logs -f api
docker compose exec api adminctl create-user -email you@example.com
docker compose exec api adminctl seed
```

## Rules that hold the design together

- **Handlers never write SQL.** New query → new method on `store`. `store`
  never writes HTTP; it returns `ErrNotFound` / `ErrConflict`.
- **Draft filtering lives in the store**, not in handlers, so a new endpoint
  cannot leak unpublished content.
- **Migrations are append-only.** Never edit a shipped `*.sql`; add the next
  numbered file.
- **`web/lib/api/types.ts` mirrors `api/internal/models`.** Nothing enforces
  it - change both.
- **No raw HTML in markdown** (`rehype-raw` stays off).
- **No em dashes or en dashes in anything a person reads** - site copy, UI
  strings, CMS content, docs, commit messages. Use a plain hyphen `-`.
- **Design tokens only.** No raw hex in components; add a token in
  `web/app/globals.css`. Serif for human words, mono for machine words.
- **Public pages must survive a dead API** - every page fetch needs a fallback,
  because `next build` runs without one.

## Shipping

Feature branch -> PR -> `checks.yml` must be green -> merge to `main` ->
`deploy.yml` builds images to GHCR and deploys the Swarm stack. Never deploy by
hand, and never commit to `main` directly. Details in `docs/ci-cd.md`.

Two compose files on purpose: `docker-compose.yml` is local development
(builds, publishes ports); `docker-stack.yml` is production (pulls from GHCR,
Traefik labels, no published ports). Change one, check the other.

## Gotchas

- `NEXT_PUBLIC_*` is baked in at image build time; changing it needs a rebuild
  of `web`, not a restart.
- `/admin/login` sits outside the `(cms)` route group on purpose: layouts nest,
  so inside it would be wrapped by `AuthGuard` and redirect forever.
- The session cookie is `SameSite=Lax`, so the site and API must be same-site.
- The login rate limiter is in-memory, which assumes one API replica.
- Column lists and `Scan` argument lists in `store/*.go` must stay in the same
  order; a mismatch fails at runtime, not at compile time.

## When adding something

`docs/recipes.md` has step-by-step lists for: adding a field, adding a demo
type, adding a settings group, adding a whole content type, writing an S3
driver. Follow those rather than improvising - they enumerate every file that
has to move together.
