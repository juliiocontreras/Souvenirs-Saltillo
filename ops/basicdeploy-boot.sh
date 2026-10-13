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
/workspace/node/bin/node server.js &
server_pid=$!
python3 ops/monitor-scheduler.py &
monitor_pid=$!
cleanup() { kill "$server_pid" "$monitor_pid" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' TERM INT
wait "$server_pid"
