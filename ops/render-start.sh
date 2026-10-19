#!/usr/bin/env bash
set -euo pipefail

# Render supplies the temporary HTTPS URL; set APP_ORIGIN explicitly after
# verifying the custom domain. Never derive the trusted origin from a request.
export APP_ORIGIN="${APP_ORIGIN:-${RENDER_EXTERNAL_URL:-}}"
if [[ -z "$APP_ORIGIN" || -z "${DATABASE_URL:-}" ]]; then
  echo 'Configure APP_ORIGIN (or RENDER_EXTERNAL_URL) and DATABASE_URL.' >&2
  exit 1
fi
export HOSTNAME=0.0.0.0
export NODE_ENV=production
exec node .next/standalone/server.js
