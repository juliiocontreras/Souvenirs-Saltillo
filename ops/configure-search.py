#!/usr/bin/env python3
"""Run in the hosting terminal; accept a Brave key without echoing or logging it."""
import getpass
import json
import os
from pathlib import Path
import shlex
import signal
import subprocess
import time
import urllib.request

secret = getpass.getpass('Clave Brave Search (no se mostrará): ').strip()
if not secret or '\n' in secret or '\r' in secret:
    raise SystemExit('Clave inválida; no se cambió la configuración.')
request = urllib.request.Request(
    'https://api.search.brave.com/res/v1/web/search?q=taza%20souvenir%20Saltillo&count=1',
    headers={'X-Subscription-Token':secret,'Accept':'application/json'})
try:
    with urllib.request.urlopen(request,timeout=30) as response:
        result=json.loads(response.read(1_000_001))
    if not isinstance(result,dict):
        raise ValueError('invalid response')
except Exception:
    raise SystemExit('Brave no aceptó la consulta. Revisa la clave y el plan; no se guardó.')

path=Path('/workspace/saltillo-private.env')
lines=[line for line in path.read_text().splitlines()
       if not line.startswith(('SEARCH_PROVIDER=','SEARCH_API_KEY='))]
lines.extend(['SEARCH_PROVIDER=brave','SEARCH_API_KEY='+shlex.quote(secret)])
temp=path.with_suffix('.tmp');temp.write_text('\n'.join(lines)+'\n')
temp.chmod(0o600);temp.replace(path)
pidfile=Path('/workspace/saltillo-server.pid')
if pidfile.exists():
    try:
        pid=int(pidfile.read_text())
        command=Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
        if command[:2]==[b'/workspace/node/bin/node',b'server.js']:
            os.kill(pid,signal.SIGTERM)
            for _ in range(50):
                if not Path(f'/proc/{pid}').exists(): break
                time.sleep(.1)
    except (OSError,ValueError):
        pass
time.sleep(1)
with open('/workspace/saltillo-runtime.log','ab') as log:
    subprocess.Popen(['/workspace/.bd_boot.sh'],stdout=log,stderr=subprocess.STDOUT,
                     start_new_session=True)
print('Clave verificada y guardada en archivo privado. Tienda reiniciada; revisa el panel.')
