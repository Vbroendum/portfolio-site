# CI/CD

Work happens on feature branches. `main` is always deployable, and deploying is
something that happens to `main` automatically rather than something you do.

```
  feature branch ──push──> PR ──> checks.yml  (go + node + stack file)
                                      │
                                 required to pass
                                      │
                                    merge
                                      ▼
                              main ──> deploy.yml
                                      │
                            checks run again on main
                                      │
                         build both images -> ghcr.io
                                      │
                           ssh -> docker stack deploy
                                      │
                      verify rollout -> smoke test the public URLs
```

Nothing is built until the checks pass, and nothing is deployed until the build
succeeds.

## The day-to-day loop

```bash
git switch -c feature/project-gallery
# ... work ...
git push -u origin feature/project-gallery
gh pr create --fill
```

The PR runs `checks.yml`. When it is green and you merge, `deploy.yml` takes
over and the change is live a few minutes later. You never run a deploy command.

Keep branches small enough to review in one sitting. The pipeline makes merging
cheap, which is the point.

## What the checks cover

| Job | Runs |
| --- | --- |
| `api` | `gofmt -l`, `go vet`, `go test -race`, `go build` |
| `web` | `npm ci`, `typecheck`, `lint`, `build` |
| `stack` | Interpolates `docker-stack.yml` and validates it |

The `stack` job exists because a typo in the stack file would otherwise only
surface on the server, halfway through a deploy.

These are the same four commands from `CLAUDE.md`, so you can run the whole
gate locally before pushing:

```bash
cd api && gofmt -l . && go vet ./... && go test ./...
cd web && npm run typecheck && npm run lint && npm run build
```

## What deploy does

1. **Re-runs the checks** on the merge commit. A green PR can still break main
   if something else landed first.
2. **Builds both images** and pushes them to GHCR tagged with the 12-character
   commit sha, plus `latest`. Layer caching lives in GitHub Actions cache, so a
   typical build is a minute or two.
3. **Copies `docker-stack.yml`** to the server, so the deployed stack always
   matches the commit.
4. **Runs `docker stack deploy`** over SSH. The server sources its own `.env`
   first: secrets live on the server and never pass through CI.
5. **Waits for the rollout** to converge, then **smoke tests** the public URLs
   through Cloudflare and Traefik, so a broken route or certificate fails the
   run rather than sitting silently.

Updates use `order: start-first`, so the new container is healthy before the old
one stops. If the new task will not start, Swarm rolls back on its own
(`failure_action: rollback`), and the verify step turns that into a red run.

## Configuration

Set these once, in GitHub under **Settings -> Secrets and variables -> Actions**.

**Secrets** (encrypted, never printed):

| Name | Value |
| --- | --- |
| `DEPLOY_HOST` | `debian.taila7cdc0.ts.net` - the server's tailnet name |
| `DEPLOY_USER` | SSH user, in the `docker` group |
| `DEPLOY_SSH_KEY` | Private key whose public half is in the server's `authorized_keys` |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client id (see below) |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret |

**Variables** (plain, visible in logs):

| Name | Value |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://vbroendum.com` |
| `PUBLIC_API_URL` | `https://api.vbroendum.com` |
| `DEPLOY_PATH` | `/home/victor/stacks/portfolio-site` |
| `DEPLOY_SSH_PORT` | Only if not 22 |

`PUBLIC_*` are variables rather than secrets because they are compiled into the
browser bundle - they are public by definition.

### Reaching the server

The server is not on the public internet - no port is forwarded to it, and that
is worth keeping. Instead the deploy job joins your tailnet for the length of
the job and leaves when it finishes, so SSH is only ever reachable from inside
the tailnet.

Set it up once, in the Tailscale admin console at
<https://console.tailscale.com>.

**1. Define the tag.** There is no point-and-click way to create a tag: it only
exists once it is in the policy file. In the left sidebar, expand **Access
controls**, then click **JSON editor**
(<https://console.tailscale.com/admin/acls>). Add `tag:ci` to `tagOwners`.
This has to come first - a credential cannot be given a tag that does not yet
exist:

```jsonc
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"],
  },
}
```

If `tagOwners` is already there, add the line inside it rather than adding a
second block. Save, and check the policy still validates.

**2. Check the tag can reach the server.** A tagged node is not a user, so a
policy written around `autogroup:member` will not cover it. With the default
allow-all `acls` there is nothing to do. With anything stricter, add:

```jsonc
{
  "action": "accept",
  "src": ["tag:ci"],
  "dst": ["debian:22"],
}
```

**3. Create the credential.** Go to **Settings -> Trust credentials**
(<https://console.tailscale.com/admin/settings/trust-credentials>), select
**Credential -> OAuth**, tick the **write** box for the **auth_keys** scope,
and pick `tag:ci` in the tag selector that appears. Select **Generate
credential**.

**4. Store both halves.** The secret is shown once and cannot be retrieved
later:

```bash
gh secret set TS_OAUTH_CLIENT_ID --body "<client id>"
gh secret set TS_OAUTH_SECRET --body "<client secret>"
```

The runner joins the tailnet as a short-lived `tag:ci` node for the length of
the deploy and disappears afterwards, so it shows up under **Machines** only
while a deploy is running.

### A deploy key worth having

Generate a key used only by CI, so revoking it does not affect your own access:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/portfolio-deploy -C "github-actions" -N ""
ssh-copy-id -i ~/.ssh/portfolio-deploy.pub victor@your-server
# paste the private key into the DEPLOY_SSH_KEY secret
cat ~/.ssh/portfolio-deploy
```

## Protecting main

Deploying on green only works if nothing can reach `main` ungreen:

This is already applied. To change it, edit the payload and re-run. Note that
the `-f` flag form does not encode the nested `required_status_checks` arrays -
it returns 200 and protects nothing - so pass a JSON body instead:

```bash
cat > protection.json <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["api (go)", "web (next.js)", "stack file"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
gh api -X PUT repos/Vbroendum/portfolio-site/branches/main/protection   --input protection.json
```

Reviews are left off because you are the only author; the status checks are the
part that matters. `strict=true` means a branch must be up to date with main
before it can merge, which is what stops two independently-green PRs from
breaking main together.

## Rolling back

Every deploy is a tagged image, so a rollback is a redeploy of an older tag:

```bash
gh workflow run deploy.yml -f image_tag=a1b2c3d4e5f6
```

Find the tag in the deploy run's log, or list what is on the server:

```bash
docker service inspect portfolio-site_web \
  --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
```

For an emergency rollback without GitHub, on the server:

```bash
docker service rollback portfolio-site_web
docker service rollback portfolio-site_api
```

That reverts to the previous spec Swarm has stored. It is one step only - for
anything older, redeploy a tag.

Rolling back code does **not** roll back the database. Migrations are
append-only and forward-only; see [database.md](database.md#migrations).

## When a deploy fails

| Symptom | Look at |
| --- | --- |
| Checks red | The PR's own log; reproduce locally with the four commands |
| Build red | Usually a Dockerfile or dependency change; the log names the layer |
| `services did not converge` | `docker service ps portfolio-site_api --no-trunc` on the server |
| Smoke test red, services fine | Traefik routing or DNS; check the labels and `docker service logs traefik_traefik` |
| 525 from Cloudflare | Cloudflare reached the origin but TLS failed; check the certresolver and SSL mode |

The stack is still serving the previous version in most of these cases, because
of `start-first` and the automatic rollback. Fix forward on a branch.

## What is deliberately not automated

- **Database migrations beyond the API's own.** They run at container start,
  guarded by an advisory lock so a rolling deploy cannot run them twice.
- **Backups.** A cron on the server owns those; see
  [deployment.md](deployment.md#backups).
- **Secret rotation.** Editing `.env` on the server and redeploying is rare
  enough to stay manual.
- **Staging.** There is one environment. For a personal site, a staging copy is
  mostly a second thing to keep working.
