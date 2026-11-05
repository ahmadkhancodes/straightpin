#!/usr/bin/env bash
# Production deploy to the SaaS Vercel account, then prune to the newest 3 deployments.
# Usage: scripts/deploy.sh [project]   (default: slug from package.json name)
set -euo pipefail
PROJECT="${1:-$(node -p "require('./package.json').name")}"
# RULE: deploy ONLY to the new SaaS account (team ahmad-code). Never use VERCEL_TOKEN or the Vercel MCP
# connector in sessions: they point at the OLD account, which is at its limit.
TOKEN="${VERCEL_TOKEN_NEW_ACCOUNT:?VERCEL_TOKEN_NEW_ACCOUNT is not set}"
export VERCEL_TEAM_ID="${VERCEL_TEAM_ID:-team_rbOXRpz6zmliuGsw8eIh3YDw}"
SCOPE_ARGS=(--scope "$VERCEL_TEAM_ID")
npx -y vercel@latest link --yes --project "$PROJECT" --token "$TOKEN" "${SCOPE_ARGS[@]}" >/dev/null
URL=$(npx -y vercel@latest deploy --prod --yes --token "$TOKEN" "${SCOPE_ARGS[@]}")
echo "deployed: $URL"
"$(dirname "$0")/vercel-keep-latest-3.sh" "$PROJECT"
