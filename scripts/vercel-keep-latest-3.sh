#!/usr/bin/env bash
# Keep only the newest N deployments (default 3) per Vercel project on the SaaS account.
# The live production deployment is never deleted, even if it is older than the newest N.
#
# Usage:
#   scripts/vercel-keep-latest-3.sh                 # all projects
#   scripts/vercel-keep-latest-3.sh <project-name>  # one project (run after each deploy)
#   DRY_RUN=1 scripts/vercel-keep-latest-3.sh       # show what would be deleted
# Env: VERCEL_TOKEN_NEW_ACCOUNT (required), VERCEL_TEAM_ID (optional), KEEP (default 3)
set -euo pipefail

TOKEN="${VERCEL_TOKEN_NEW_ACCOUNT:?VERCEL_TOKEN_NEW_ACCOUNT is not set (new session needed?)}"
KEEP="${KEEP:-3}"
DRY_RUN="${DRY_RUN:-0}"
API="https://api.vercel.com"
SCOPE=""
[ -n "${VERCEL_TEAM_ID:-}" ] && SCOPE="teamId=${VERCEL_TEAM_ID}&"

api() { # method path
  curl -sS --fail-with-body -X "$1" -H "Authorization: Bearer ${TOKEN}" "${API}$2"
}

projects() {
  if [ $# -gt 0 ]; then
    api GET "/v9/projects/$1?${SCOPE%&}" | jq -r '[.id, .name] | @tsv'
  else
    api GET "/v10/projects?${SCOPE}limit=100" | jq -r '.projects[] | [.id, .name] | @tsv'
  fi
}

total=0
while IFS=$'\t' read -r pid pname; do
  [ -z "$pid" ] && continue
  prod=$(api GET "/v9/projects/${pid}?${SCOPE%&}" | jq -r '.targets.production.id // empty')
  # Newest first. Skip deployments still building so we never cancel an active build.
  mapfile -t ids < <(api GET "/v6/deployments?${SCOPE}projectId=${pid}&limit=100" \
    | jq -r '.deployments | sort_by(-.created) | .[] | select(.state != "BUILDING" and .state != "QUEUED" and .state != "INITIALIZING") | .uid')
  n=0; deleted=0
  for id in "${ids[@]}"; do
    n=$((n + 1))
    [ "$n" -le "$KEEP" ] && continue
    [ "$id" = "$prod" ] && { echo "  keep $id (live production)"; continue; }
    if [ "$DRY_RUN" = "1" ]; then
      echo "  would delete $id"
    else
      api DELETE "/v13/deployments/${id}?${SCOPE%&}" >/dev/null && echo "  deleted $id"
    fi
    deleted=$((deleted + 1))
  done
  echo "${pname}: ${#ids[@]} deployments, kept ${KEEP}, removed ${deleted}"
  total=$((total + deleted))
done < <(projects "$@")
echo "Done. Removed ${total} deployment(s)$([ "$DRY_RUN" = "1" ] && echo ' (dry run)')."
