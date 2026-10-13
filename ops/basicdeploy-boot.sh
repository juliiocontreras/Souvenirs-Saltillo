#!/bin/sh
# BasicDeploy invokes /workspace/.bd_boot.sh on wake/restart.
set -eu
umask 077
exec 9>/workspace/saltillo-server.lock
flock -n 9 || exit 0
set -a
. /workspace/saltillo-private.env
set +a
cd /workspace/saltillo/current
export NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
export NODE_OPTIONS=--max-old-space-size=128
exec /workspace/node/bin/node server.js
