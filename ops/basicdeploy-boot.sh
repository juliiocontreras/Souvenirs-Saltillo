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
export NODE_ENV=production PORT=8081 HOSTNAME=127.0.0.1
export NODE_OPTIONS=--max-old-space-size=128
/workspace/node/bin/node server.js &
server_pid=$!
printf '%s\n' "$server_pid" > /workspace/saltillo-server.pid
PORT=8080 NODE_OPTIONS=--max-old-space-size=32 /workspace/node/bin/node ops/http-entry.mjs &
entry_pid=$!
python3 ops/monitor-scheduler.py &
monitor_pid=$!
cleanup() { kill "$server_pid" "$entry_pid" "$monitor_pid" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' TERM INT
wait "$server_pid"
