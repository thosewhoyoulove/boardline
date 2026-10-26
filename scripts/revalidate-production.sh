#!/usr/bin/env bash
# Ask production to drop cached board HTML after a successful database write.
# Requires REVALIDATE_SECRET (same value as the Vercel Production env var).
# Optional REVALIDATE_URL overrides the production endpoint.
set -euo pipefail

if [[ -z "${REVALIDATE_SECRET:-}" ]]; then
  echo "Set the REVALIDATE_SECRET repository secret to the same value as Vercel Production REVALIDATE_SECRET." >&2
  exit 1
fi

url="${REVALIDATE_URL:-https://boardline.vercel.app/api/revalidate}"
echo "Revalidating ${url}"

curl --fail-with-body --silent --show-error \
  --noproxy '*' \
  --retry 3 --retry-all-errors --retry-delay 5 --max-time 60 \
  --request POST \
  --header "Authorization: Bearer ${REVALIDATE_SECRET}" \
  --header "Accept: application/json" \
  "${url}"
echo
