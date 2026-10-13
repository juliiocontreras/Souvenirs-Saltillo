#!/usr/bin/env python3
"""Configure the free Tavily plan from the hosting terminal, without echoing keys."""
import getpass
import json
import math
import os
from pathlib import Path
import shlex
import signal
import subprocess
import time
import urllib.request

secret = getpass.getpass('Clave Tavily (no se mostrará): ').strip()
if not secret or '\n' in secret or '\r' in secret:
    raise SystemExit('Clave inválida; no se cambió la configuración.')
request = urllib.request.Request(
    'https://api.tavily.com/usage',
    headers={'Authorization':'Bearer '+secret,'Accept':'application/json'})
# API credentials must never follow a redirect to another host.
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args): return None
try:
    with urllib.request.build_opener(NoRedirect()).open(request,timeout=30) as response:
        result=json.loads(response.read(1_000_001))
    if not isinstance(result,dict) or not isinstance(result.get('account'),dict):
        raise ValueError('invalid response')
except Exception:
    raise SystemExit('Tavily no aceptó la consulta de uso. Revisa la clave; no se guardó.')

account=result['account']
if str(account.get('current_plan','')).lower() not in ('free','researcher'):
    raise SystemExit('Selecciona el plan gratuito Researcher de Tavily; no se guardó la clave.')
try:
    paid_limit=float(account.get('paygo_limit') or 0)
except (TypeError,ValueError):
    raise SystemExit('No se pudo verificar el límite de pago por uso; no se guardó la clave.')
if not math.isfinite(paid_limit) or paid_limit < 0:
    raise SystemExit('No se pudo verificar el límite de pago por uso; no se guardó la clave.')
if paid_limit > 0:
    raise SystemExit('Desactiva el pago por uso en Tavily antes de configurar esta tienda.')

path=Path('/workspace/saltillo-private.env')
lines=[line for line in path.read_text().splitlines()
       if not line.startswith(('SEARCH_PROVIDER=','SEARCH_API_KEY=','SEARCH_MONTHLY_LIMIT='))]
lines.extend(['SEARCH_PROVIDER=tavily','SEARCH_API_KEY='+shlex.quote(secret),'SEARCH_MONTHLY_LIMIT=900'])
temp=path.with_suffix('.tmp');temp.write_text('\n'.join(lines)+'\n')
temp.chmod(0o600);temp.replace(path)
pidfile=Path('/workspace/saltillo-server.pid')
if pidfile.exists():
    try:
        pid=int(pidfile.read_text())
        # Next.js changes its process title, so cmdline is not stable.
        executable=Path(f'/proc/{pid}/exe').resolve()
        directory=Path(f'/proc/{pid}/cwd').resolve()
        if executable==Path('/workspace/node/bin/node') and directory==Path('/workspace/saltillo/current').resolve():
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
print('Tavily gratuito verificado; clave privada guardada y límite de 900 consultas mensuales configurado. Tienda reiniciada; revisa el panel.')
