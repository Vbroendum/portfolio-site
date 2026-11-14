# Deployment

The site runs as a Docker Swarm stack on a Debian server, behind the Traefik
that already fronts the other services there. Images come from GHCR, built by
CI. Nothing is deployed by hand - see [ci-cd.md](ci-cd.md) for the pipeline.

## Layout

```
                     Cloudflare edge
                            |
                   (no inbound ports open)
                            |
                   cloudflared tunnel
                            |
              https://127.0.0.1:443  (SNI = the hostname)
                            |
                     Traefik v2.11
                  traefik-public overlay
                     |             |
                 web :3000     api :8080
                                   |
                          internal overlay
                                   |
                            postgres :5432
                                   \__ uploads volume
```

Nothing listens on the public internet. The router forwards no ports; traffic
arrives through the Cloudflare Tunnel that already serves the other services
on this host, and Traefik routes by `Host` header from there.

Certificates are issued by Traefik's existing `cloudflare` resolver over the
DNS-01 challenge.

## Hostnames

| Hostname | Serves |
| --- | --- |
| `vbroendum.com` | the site |
| `www.vbroendum.com` | the site (same router) |
| `api.vbroendum.com` | the API and `/media` |

Both names are subdomains of one parent, which is what lets the session cookie
work across them - see
[configuration.md](configuration.md#cookies-and-origins).

## Routing a new hostname

DNS alone is not enough: the tunnel needs a route, and the tunnel is run from a
token, so its routes live in the Cloudflare dashboard rather than in a file on
the server.

In **Zero Trust -> Networks -> Tunnels -> (the tunnel) -> Routes**, add a
published application:

| Field | Value |
| --- | --- |
| Service type | HTTPS |
| URL | `127.0.0.1:443` |
| TLS -> Origin Server Name | the hostname being routed |

**Origin Server Name is the part that is easy to miss.** cloudflared connects
to `127.0.0.1`, so without it the TLS SNI is an IP address, Traefik has no
router for that, it falls back to its default self-signed certificate, and
Cloudflare reports 502. Setting it makes Traefik present the real certificate
it already holds.

Cloudflare creates the DNS record itself when the route is saved. Delete any
conflicting A/AAAA record for that name first, or it cannot.

Leave the HTTP Host header alone: Traefik routes on it, and cloudflared passes
the original through.

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

### 2. Route the hostnames

Add `vbroendum.com`, `www.vbroendum.com` and `api.vbroendum.com` as tunnel
routes, as described in
[Routing a new hostname](#routing-a-new-hostname) above. Delete any existing
A/AAAA record for those names first.

### 3. GitHub

Add the secrets and variables listed in
[ci-cd.md](ci-cd.md#configuration), including the Tailscale credentials the
deploy job uses to reach the server.

### 4. Merge to main

The pipeline builds, pushes and deploys.

**Only once that deploy has gone green** does a container exist to talk to.
Then create your account:

```bash
scp scripts/adminctl.sh victor@debian:~/stacks/portfolio-site/
ssh victor@debian
cd ~/stacks/portfolio-site
./adminctl.sh create-user -email you@example.com -name "Your Name"
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
~/stacks/portfolio-site/adminctl.sh set-password -email you@example.com
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
