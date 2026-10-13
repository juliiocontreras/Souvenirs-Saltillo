#!/usr/bin/env python3
"""Four-hour scheduler for the BasicDeploy boot hook; no external dependencies."""
import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request

STATE = Path('/workspace/.saltillo-monitor-state.json')
PERIOD = 4 * 60 * 60
OFFSET = 17 * 60


def elapsed_slot(now):
    return ((int(now) - OFFSET) // PERIOD) * PERIOD + OFFSET


def saved_slot():
    try:
        return int(json.loads(STATE.read_text())['completed_slot'])
    except FileNotFoundError:
        return 0


def run_batches(opener, secret):
    deadline = time.monotonic() + 1800
    for _ in range(100):
        if time.monotonic() >= deadline:
            raise RuntimeError('monitor deadline reached')
        request = urllib.request.Request(
            'http://127.0.0.1:8080/api/supplier/monitor', data=b'',
            headers={'Authorization': 'Bearer ' + secret}, method='POST')
        with opener.open(request, timeout=300) as response:
            result = json.loads(response.read(1_000_001))
        if result.get('status') != 'completed':
            raise RuntimeError('monitor did not complete')
        remaining = result.get('remaining')
        if not isinstance(remaining, int) or remaining < 0:
            raise RuntimeError('invalid pending count')
        print(f"monitor batch: checked={result.get('checked')} remaining={remaining}", flush=True)
        if remaining == 0:
            return
    raise RuntimeError('monitor batch limit reached')


def main():
    secret = os.environ.get('MONITOR_SECRET', '')
    if len(secret) < 32:
        raise RuntimeError('MONITOR_SECRET is not configured')
    # Loopback is inside this container; do not send the local secret to a proxy.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while True:
        slot = elapsed_slot(time.time())
        try:
            if saved_slot() < slot:
                run_batches(opener, secret)
                temp = STATE.with_suffix('.tmp')
                temp.write_text(json.dumps({'completed_slot': slot,
                    'completed_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                    'next_slot': slot + PERIOD}))
                temp.chmod(0o600)
                temp.replace(STATE)
                print('scheduled monitor completed; next UTC slot: ' +
                      dt.datetime.fromtimestamp(slot + PERIOD, dt.timezone.utc).isoformat(), flush=True)
            time.sleep(30)
        except (OSError, ValueError, RuntimeError, urllib.error.HTTPError):
            # Never print credentials, connection strings or page content.
            print('scheduled monitor pending; retrying in 60 seconds', flush=True)
            time.sleep(60)


if __name__ == '__main__':
    main()
