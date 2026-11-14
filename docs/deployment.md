# Deployment

The site runs as a Docker Swarm stack on a Debian server, behind the Traefik
that already fronts the other services there. Images come from GHCR, built by
CI. Nothing is deployed by hand - see [ci-cd.md](ci-cd.md) for the pipeline.

## Layout

```
          Cloudflare (DNS + proxy)
                    │
          ┌─────────┴──────────┐
   vbroendum.com        api.vbroendum.com
          │                    │
          └──────► Traefik v2.11 (:443) ◄──────┘
                  traefik-public overlay
                    │                │
              web :3000          api :8080
                                     │
                            internal overlay
                                     │
                              postgres :5432
                                     └── uploads volume
```

Only Traefik publishes ports. `web`, `api` and `postgres` are reachable only
over the overlay networks, and `postgres` is not on `traefik-public` at all.

Certificates come from Traefik's existing `cloudflare` resolver, which uses the
DNS-01 challenge - so the records can stay proxied (orange cloud).

## First deploy

### 1. On the server

```bash
scp scripts/server-bootstrap.sh victor@debian:~
ssh victor@debian 'bash server-bootstrap.sh'
```

It checks that Swarm and the `traefik-public` network are there, creates
`~/stacks/portfolio-site/`, and writes a `.env` with freshly generated secrets
(mode 600). Re-running it leaves an existing `.env` alone.

Secrets live on the server and never pass through CI.

### 2. DNS

In Cloudflare, both pointing at the server, proxy on:

| Record | Name |
| --- | --- |
| A / AAAA | `vbroendum.com` |
| A / AAAA | `api.vbroendum.com` |

Set the zone's SSL mode to **Full (strict)**. Anything else gives a 525 once
Traefik serves a real certificate.

### 3. GitHub

Add the secrets and variables listed in [ci-cd.md](ci-cd.md#configuration).

### 4. Push

```bash
git push origin main
```

The pipeline builds, pushes and deploys. Then create your account:

```bash
ssh victor@debian
docker exec -it $(docker ps -q -f name=portfolio-site_api) \
  adminctl create-user -email you@example.com -name "Your Name"
```

Sign in at `https://vbroendum.com/admin/login`.

## Updating

Merge to `main`. That is the whole procedure.

To deploy without a code change (after editing `.env`, say):

```bash
gh workflow run deploy.yml
```

To deploy an older build, pass its tag - see
[ci-cd.md](ci-cd.md#rolling-back).

## Manual deploy

Only needed when GitHub is unavailable:

```bash
ssh victor@debian
cd ~/stacks/portfolio-site
set -a; . ./.env; set +a
IMAGE_TAG=latest docker stack deploy -c docker-stack.yml --prune \
  --with-registry-auth portfolio-site
```

`docker stack deploy` does not read `.env` on its own, which is what the
`set -a` is for.

## Operations

```bash
docker stack services portfolio-site
docker service ps portfolio-site_api --no-trunc    # why a task will not start
docker service logs -f portfolio-site_api
docker service logs -f portfolio-site_web

curl -s https://api.vbroendum.com/healthz

# psql
docker exec -it $(docker ps -q -f name=portfolio-site_postgres) \
  psql -U portfolio -d portfolio

# change your password
docker exec -it $(docker ps -q -f name=portfolio-site_api) \
  adminctl set-password -email you@example.com
```

The API logs structured JSON, one line per request, with a request id. Grep for
`"level":"ERROR"` first.

`/healthz` pings the database, so it fails when Postgres is down. Point an
uptime monitor at it rather than at the home page.

## Backups

Two things matter: the database and the uploads volume. Restoring one without
the other leaves broken images.

```bash
#!/bin/sh
# /etc/cron.daily/portfolio-site-backup
set -e
day=$(date +%F)
out=/home/victor/backups

db=$(docker ps -q -f name=portfolio-site_postgres)
docker exec "$db" pg_dump -U portfolio portfolio | gzip > "$out/portfolio-db-$day.sql.gz"

docker run --rm -v portfolio-site_uploads:/data -v "$out":/out alpine \
  tar czf "/out/portfolio-uploads-$day.tar.gz" -C /data .

find "$out" -name 'portfolio-*' -mtime +30 -delete
```

Copy them off the machine. A backup on the same disk is not a backup.

Restore:

```bash
gunzip -c portfolio-db-2026-11-14.sql.gz | \
  docker exec -i $(docker ps -q -f name=portfolio-site_postgres) \
  psql -U portfolio -d portfolio

docker run --rm -v portfolio-site_uploads:/data -v "$PWD":/in alpine \
  tar xzf /in/portfolio-uploads-2026-11-14.tar.gz -C /data
```

## Hardening checklist

- [ ] `.env` on the server is mode 600 and not in git
- [ ] `JWT_SECRET` is 32+ random bytes
- [ ] Cloudflare SSL mode is Full (strict)
- [ ] The CI SSH key is a dedicated key, not your personal one
- [ ] GHCR packages are public, or the server has a `read:packages` token
- [ ] Backups run, and one has been restored as a test
- [ ] `CORS_ORIGINS` is your site only (the stack sets this from
      `PUBLIC_SITE_URL`)

## Running it somewhere else

The stack assumes Swarm and Traefik because that is what the server already
runs. On a plain VPS with nothing on it, `docker-compose.yml` in the repo root
is self-contained: it builds locally, publishes ports 3000 and 8080, and needs
only a reverse proxy in front. The two files describe the same system; keep
them in step when you change one.

## Scaling, if it ever matters

In order of what would actually help:

1. Put a CDN in front of `/media` and point `PUBLIC_MEDIA_BASE_URL` at it.
2. Raise `DEFAULT_REVALIDATE` in `web/lib/api/server.ts` - tag purging keeps
   edits instant anyway.
3. Move uploads to S3 (see [recipes.md](recipes.md#add-an-s3-storage-driver)),
   which also frees `api` from the manager-node placement constraint.
4. Only then run more than one `api` replica - and move the login rate limiter
   out of memory first.
