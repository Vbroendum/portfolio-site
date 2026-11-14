#!/usr/bin/env bash
#
# Run adminctl inside the running API container. Use it ON THE SERVER:
#
#   ./adminctl.sh create-user -email you@example.com -name "Your Name"
#   ./adminctl.sh set-password -email you@example.com
#   ./adminctl.sh migrate
#
# Doing this by hand is easy to get wrong: if the container lookup comes back
# empty, `docker exec -it $(...) adminctl ...` reads "adminctl" as the container
# name and reports "No such container: adminctl", which says nothing about the
# real problem - that the stack is not running.
set -euo pipefail

SERVICE="${SERVICE:-portfolio-site_api}"

cid=$(docker ps -q --filter "name=${SERVICE}" | head -1)

if [ -z "$cid" ]; then
  echo "No running container for '${SERVICE}'." >&2
  echo >&2
  if docker stack ls --format '{{.Name}}' | grep -qx "${SERVICE%%_*}"; then
    echo "The stack exists but the API task is not running. Look at:" >&2
    echo "  docker stack services ${SERVICE%%_*}" >&2
    echo "  docker service ps ${SERVICE} --no-trunc" >&2
  else
    echo "The stack is not deployed yet. Merge to main and let the deploy" >&2
    echo "workflow run, or deploy by hand - see docs/deployment.md." >&2
  fi
  exit 1
fi

exec docker exec -it "$cid" adminctl "$@"
