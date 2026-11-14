# Recipes

Step-by-step for the changes you are most likely to make. Each one lists every
file that has to move together.

## Add a field to posts or projects

Say you want `projects.video_poster_url`.

1. **Migration** - `api/internal/migrations/0002_project_video_poster.sql`:
   ```sql
   ALTER TABLE projects ADD COLUMN video_poster_url TEXT NOT NULL DEFAULT '';
   ```
   Never edit `0001_init.sql`; it has already run.
2. **Model** - add the field to `models.Project` with its JSON tag.
3. **Input** - add it to `store.ProjectInput`.
4. **Queries** - add the column to `projectColumns`, to the `scanProject`
   argument list (same order), and to the INSERT and UPDATE statements. The
   column list and the scan list must stay in lockstep; a mismatch is a runtime
   error, not a compile error.
5. **Validation** - if it has rules, add them in `validateProject`.
6. **Frontend types** - `web/lib/api/types.ts`: `Project` and `ProjectInput`.
7. **Editor** - add a field in `web/app/admin/(cms)/projects/[id]/page.tsx`,
   including in `EMPTY` and in the `getProject(...)` mapping.
8. **Render** - use it in the public page.
9. `cd api && go test ./...` and `cd web && npm run typecheck`.

Restart the API; the migration applies at boot.

## Add a new demo type

Say `codesandbox`.

1. **Migration** - `ALTER TYPE demo_type ADD VALUE 'codesandbox';`
   (Postgres allows adding enum values; it does not allow removing them.)
2. **Go** - add the constant to `models.DemoType` and to the `Valid()` switch.
   If the type needs a `demo_url`, add it to the required-URL switch in
   `validateProject`.
3. **Types** - add it to the `DemoType` union in `web/lib/api/types.ts`.
4. **Renderer** - add a case to `DemoBody` and a caption to `captionFor` in
   `web/components/project-demo.tsx`.
5. **Editor** - add the option to the demo-type `Select` and a line to
   `DEMO_HINTS` in the project editor.
6. **Docs** - add a row to the table in [cms.md](cms.md#choosing-a-demo-type).

## Add a settings group

Say `resume` with a PDF link.

1. **Migration** - `INSERT INTO settings (key, value) VALUES ('resume', '{"pdf_media_id":null}'::jsonb);`
2. **Allowlist** - add `"resume"` to `allowedSettingKeys` in
   `api/internal/httpapi/handlers_settings.go`.
3. **Types** - add it to the `Settings` interface.
4. **CMS** - add a section to `web/app/admin/(cms)/settings/page.tsx` and a
   `putSetting("resume", ...)` call in `save()`.
5. **Render** it wherever it belongs.
6. Document it in [cms.md](cms.md#settings).

## Add a new content type

A whole new entity (say `talks`) follows the same path as posts:

1. Migration with the table.
2. `models.Talk`.
3. `store/talks.go` with `List/Get/Create/Update/Delete`, drafts filtered in
   the store, not in the handler.
4. `httpapi/handlers_talks.go` with public reads and admin writes.
5. Routes in `router.go` - public under `/api/v1`, writes under
   `/api/v1/admin`.
6. Types, an admin client section, a CMS list + editor, a public page.
7. A cache tag: add it to `CACHE_TAGS` in `lib/api/server.ts` and to `ALLOWED`
   in `app/api/revalidate/route.ts`.

Copying `posts.go` and `handlers_posts.go` and editing them is the intended
workflow - the layers are small on purpose.

## Add an S3 storage driver

1. Create `api/internal/media/s3.go` implementing `Storage`:
   - `Put` → `PutObject`, returning the same `year/month/random-name.ext` key.
   - `Delete` → `DeleteObject`.
   - `Handler` → a redirect to the public bucket URL, or a 404 if the bucket is
     served directly by a CDN.
2. Add the `case "s3":` branch in `media.New()`.
3. Add the config it needs (bucket, region, credentials) to
   `config.Config` and `docker-compose.yml`.
4. Set `STORAGE_DRIVER=s3` and `PUBLIC_MEDIA_BASE_URL` to the bucket or CDN
   origin, and add that host to `images.remotePatterns` in `next.config.ts`.

Nothing in `httpapi` or `store` changes - they only handle the opaque key.

## Change the look

Everything visual starts in `web/app/globals.css`. Change the tokens there
rather than editing components. [design.md](design.md) explains what each token
is for and which rules hold the design together.

To change the typefaces, edit the `next/font/google` imports in
`web/app/layout.tsx` and the `--font-*` tokens. Keep the serif/mono split or
decide deliberately to replace it - half-applying it is what makes a design
look accidental.

## Rotate the signing secret

```bash
# in .env
JWT_SECRET=<new value>
docker compose up -d api
```

Every existing session is invalidated. Nothing else is affected - passwords are
hashed separately.

## Reset local data

```bash
docker compose down -v      # drops the database AND the uploads volume
docker compose up -d --build
docker compose exec api adminctl create-user -email dev@example.com
docker compose exec api adminctl seed
```

## Import existing markdown posts

There is no import command. The quickest route is a shell loop against the
admin API:

```bash
curl -s -c ck.txt -X POST localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}'

for f in ~/old-blog/*.md; do
  python - "$f" <<'PY' | curl -s -b ck.txt -X POST localhost:8080/api/v1/admin/posts \
      -H 'Content-Type: application/json' -d @-
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
body = p.read_text(encoding="utf-8")
print(json.dumps({
    "slug": "", "title": p.stem.replace("-", " ").title(),
    "summary": "", "body_markdown": body,
    "cover_media_id": None, "tags": [], "status": "draft",
    "published_at": None,
}))
PY
done
```

Import as drafts, then review and publish from the CMS.
