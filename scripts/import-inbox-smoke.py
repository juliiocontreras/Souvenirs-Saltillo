"""Exercise import recovery on an isolated local store, never production data."""
import json,os,secrets,socket,subprocess,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'import-inbox';OUT.mkdir(parents=True,exist_ok=True)
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
origin=f'http://localhost:{port}';password=secrets.token_urlsafe(24);monitor_secret=secrets.token_hex(32)
fixture={'id':'pending-test','status':'preview','createdAt':'2026-10-24T12:00:00Z','sourceUrl':'https://supplier.example/product','options':[{'title':'Termo de prueba','description':'Ficha sintética local.','identityKey':'test-thermos','supplierCost':None,'currency':None,'deliveryDays':None,'images':[]}]}
with tempfile.TemporaryDirectory(prefix='saltillo-inbox-') as folder:
 file=Path(folder)/'catalog.json';file.write_text(json.dumps({'drafts':{'pending-test':fixture}}))
 env=dict(os.environ,NODE_ENV='production',DATABASE_URL='',CATALOG_DATA_FILE=str(file),ADMIN_PASSWORD=password,AUTH_SECRET=secrets.token_hex(32),MONITOR_SECRET=monitor_secret,APP_ORIGIN=origin,SEARCH_PROVIDER='',SEARCH_API_KEY='',NEXT_TELEMETRY_DISABLED='1')
 with (OUT/'server.log').open('w') as log:
  process=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=log)
  try:
   with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page();page.set_default_timeout(15000)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    for attempt in range(60):
     try:page.goto(origin+'/login');break
     except Exception:time.sleep(.25)
    else:raise RuntimeError('Server did not start')
    for path in ['/api/supplier/import','/api/supplier/import/pending-test']:
     assert context.request.get(origin+path).status==401
    response=context.request.post(origin+'/api/supplier/monitor',headers={'Authorization':'Bearer '+monitor_secret})
    assert response.status==200
    assert set(response.json())=={'status','checked','remaining','added','issues','searches'}
    page.get_by_label('Contraseña',exact=True).fill(password)
    page.get_by_role('button',name='Entrar al panel',exact=True).click();page.wait_for_url('**/admin')
    inbox=page.get_by_role('region',name='Importaciones pendientes')
    inbox.get_by_text('Termo de prueba',exact=True).wait_for()
    page.reload(wait_until='networkidle')
    response=context.request.get(origin+'/api/supplier/import/pending-test')
    assert response.status==200 and 'no-store' in response.headers['cache-control']
    assert context.request.get(origin+'/api/supplier/import/constructor').status==404
    inbox.get_by_role('button',name='Continuar revisión').click()
    preview=page.get_by_role('region',name='Vista previa del producto')
    preview.get_by_role('heading',name='Vista previa del producto').wait_for()
    assert page.get_by_label('Título',exact=True).input_value()=='Termo de prueba'
    assert page.get_by_label('Costo de proveedor',exact=True).input_value()==''
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
    page.get_by_role('button',name='Cerrar vista previa',exact=True).click()
    page.set_viewport_size({'width':390,'height':844});page.reload(wait_until='networkidle')
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    inbox.scroll_into_view_if_needed();page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    inbox.get_by_role('button',name='Continuar revisión').click()
    page.get_by_role('button',name='Guardar borrador',exact=True).click()
    page.get_by_text('Producto guardado como borrador.',exact=True).wait_for()
    assert inbox.get_by_text('No hay fichas pendientes de revisión.',exact=True).is_visible()
    assert context.request.get(origin+'/api/supplier/import/pending-test').status==409
    assert context.request.get(origin+'/api/products').json()['products']==[]
    page.reload(wait_until='networkidle')
    assert inbox.get_by_text('No hay fichas pendientes de revisión.',exact=True).is_visible()
    assert len(context.request.get(origin+'/api/products?scope=admin').json()['products'])==1
    assert errors==[],errors
    browser.close()
   print(json.dumps({'inbox_reload':True,'reopen_desktop_mobile':True,'private_routes':True,'applied_import_hidden':True,'saved_product_stays_private':True,'compact_monitor_response':True,'javascript_errors':0}))
  finally:
   process.terminate();process.wait(timeout=15)
