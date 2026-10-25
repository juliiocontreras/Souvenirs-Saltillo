"""Production Next.js smoke test using ephemeral credentials and synthetic public fixtures."""
import base64
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ARTIFACTS=ROOT/'artifacts'


def supplier_url(price=100, with_identifiers=True):
    item={'@context':'https://schema.org','@type':'Product','name':'Taza de prueba','description':'Ficha sintética para verificar la integración. No es un producto real de la tienda.',
          'image':'https://httpbin.org/image/png','gtin13':'7501234567890','sku':'TEST-350','color':'blanco',
          'offers':{'@type':'Offer','price':price,'priceCurrency':'MXN','shippingDetails':{'deliveryTime':{
              'handlingTime':{'minValue':1,'maxValue':2,'unitCode':'DAY'},'transitTime':{'minValue':2,'maxValue':4,'unitCode':'DAY'}}}}}
    if not with_identifiers:item.pop('gtin13')
    markup='<script type="application/ld+json">'+json.dumps(item,separators=(',',':'),ensure_ascii=False)+'</script>'
    return 'https://httpbin.org/base64/'+quote(base64.b64encode(markup.encode()).decode(),safe='')


def main():
    ARTIFACTS.mkdir(exist_ok=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    origin=f'http://localhost:{port}'
    password=secrets.token_urlsafe(24)
    errors=[]
    with tempfile.TemporaryDirectory(prefix='saltillo-browser-') as temp, (ARTIFACTS/'ui-server.log').open('w') as log:
        environment=dict(os.environ,NODE_ENV='production',ADMIN_PASSWORD=password,AUTH_SECRET=secrets.token_hex(32),MONITOR_SECRET=secrets.token_hex(32),APP_ORIGIN=origin,CATALOG_DATA_FILE=str(Path(temp)/'catalog.json'),DATABASE_URL='',SEARCH_PROVIDER='',SEARCH_API_KEY='',NEXT_TELEMETRY_DISABLED='1')
        process=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',str(port)],cwd=ROOT,env=environment,stdout=log,stderr=log)
        try:
            with sync_playwright() as driver:
                proxy={'server':os.environ['HTTP_PROXY'],'bypass':'localhost,127.0.0.1'} if os.environ.get('HTTP_PROXY') else None
                browser=driver.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],proxy=proxy)
                context=browser.new_context(viewport={'width':1440,'height':1000})
                page=context.new_page();page.set_default_timeout(15000)
                page.on('pageerror',lambda error:errors.append(str(error)))
                for _ in range(60):
                    try:page.goto(origin,wait_until='networkidle');break
                    except Exception:time.sleep(.2)
                assert page.get_by_role('heading',name='Souvenirs con identidad.').is_visible()
                page.screenshot(path=str(ARTIFACTS/'01-store-empty.png'),full_page=True)
                page.goto(origin+'/login',wait_until='networkidle');page.screenshot(path=str(ARTIFACTS/'02-login.png'),full_page=True)
                assert context.request.get(origin+'/api/products?scope=admin').status==401
                assert context.request.post(origin+'/api/supplier/monitor',headers={'Authorization':'Bearer undefined'}).status==401
                page.locator('body').aria_snapshot()
                page.get_by_label('Contraseña',exact=True).fill('deliberately-wrong')
                page.get_by_role('button',name='Entrar al panel').click()
                page.get_by_role('alert').filter(has_text='Contraseña incorrecta').wait_for()
                page.locator('body').aria_snapshot()
                page.get_by_label('Contraseña',exact=True).fill(password)
                page.get_by_role('button',name='Entrar al panel').click();page.wait_for_url('**/admin')
                page.screenshot(path=str(ARTIFACTS/'03-admin-empty.png'),full_page=True)
                page.get_by_label('Enlace del producto',exact=True).fill('http://127.0.0.1/private')
                page.get_by_role('button',name='Analizar enlace').click()
                page.get_by_role('alert').filter(has_text='enlace público').wait_for()
                page.screenshot(path=str(ARTIFACTS/'04-invalid-source.png'),full_page=True)
                page.locator('body').aria_snapshot()
                page.get_by_label('Enlace del producto',exact=True).fill(supplier_url())
                page.get_by_role('button',name='Analizar enlace').click()
                page.get_by_role('heading',name='Vista previa del producto').wait_for(timeout=90000)
                page.get_by_label('Margen bruto · %',exact=True).fill('30')
                page.get_by_text('143 MXN',exact=True).wait_for()
                page.screenshot(path=str(ARTIFACTS/'05-import-preview.png'),full_page=True)
                page.get_by_label('Título',exact=True).fill('Taza de prueba personalizada')
                page.get_by_label('Este producto se puede personalizar').check()
                page.get_by_label('Confirmé unidad',exact=False).check()
                page.get_by_role('button',name='Aprobar y publicar').click()
                page.get_by_text('Producto publicado en la tienda.',exact=True).wait_for(timeout=30000)
                page.screenshot(path=str(ARTIFACTS/'06-admin-catalog.png'),full_page=True)
                page.locator('body').aria_snapshot()
                page.get_by_role('button',name='Historial y alternativas').click()
                page.get_by_label('Enlace alternativo',exact=True).wait_for()
                page.get_by_label('Enlace alternativo',exact=True).fill(supplier_url(90))
                page.get_by_role('button',name='Verificar alternativa',exact=True).click()
                page.get_by_text('Alternativa consultada. Revisa su identidad y condiciones.',exact=True).wait_for(timeout=90000)
                page.get_by_role('button',name='Revisar para sustituir').click()
                page.get_by_role('heading',name='Vista previa del producto').wait_for(timeout=90000)
                assert page.get_by_label('Costo de proveedor',exact=True).input_value()=='90'
                page.get_by_role('button',name='Cerrar vista previa').click()
                # Approval is deliberately omitted: source selection cannot silently replace the supplier.
                private=context.request.get(origin+'/api/products?scope=admin').json()['products'][0]
                assert private['supplierCost']==100
                page.get_by_label('Enlace alternativo',exact=True).fill(supplier_url(85,False))
                page.get_by_role('button',name='Verificar alternativa',exact=True).click()
                page.get_by_text('Alternativa consultada. Revisa su identidad y condiciones.',exact=True).wait_for(timeout=90000)
                page.get_by_label('Confirmé que la ficha corresponde',exact=False).check()
                page.locator('.alternative').last.get_by_role('button',name='Revisar para sustituir').click()
                page.get_by_role('heading',name='Vista previa del producto').wait_for(timeout=90000)
                assert page.get_by_label('Costo de proveedor',exact=True).input_value()=='85'
                page.get_by_role('button',name='Cerrar vista previa').click()
                page.get_by_role('button',name='Revisar proveedores',exact=True).click()
                page.get_by_text('Revisión terminada. Consulta los resultados y cambios pendientes.',exact=True).wait_for(timeout=180000)
                assert context.request.get(origin+'/api/supplier/runs').json()['runs'][0]['status']=='completed'
                page.screenshot(path=str(ARTIFACTS/'07-monitor-results.png'),full_page=True)
                public=context.request.get(origin+'/api/products').json()['products']
                assert len(public)==1 and 'supplierCost' not in public[0] and 'supplierUrl' not in public[0] and 'evidence' not in public[0]
                store=context.new_page();store.goto(origin,wait_until='networkidle')
                assert store.get_by_role('heading',name='Taza de prueba personalizada').is_visible()
                store.screenshot(path=str(ARTIFACTS/'08-store-catalog-desktop.png'),full_page=True)
                image_loaded=store.locator('.product-image img').evaluate('(image)=>image.complete && image.naturalWidth>0')
                store.get_by_label('Buscar productos',exact=True).fill('does-not-exist')
                assert store.get_by_role('heading',name='No encontramos ese artículo').is_visible()
                store.get_by_role('button',name='Ver todos los artículos').click()
                store.get_by_role('button',name='Personalizados',exact=True).click()
                assert store.get_by_role('heading',name='Taza de prueba personalizada').is_visible()
                store.set_viewport_size({'width':390,'height':844})
                assert store.evaluate('document.documentElement.scrollWidth<=innerWidth')
                store.screenshot(path=str(ARTIFACTS/'09-store-catalog-mobile.png'),full_page=True)
                page.set_viewport_size({'width':390,'height':844})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.screenshot(path=str(ARTIFACTS/'10-admin-mobile.png'),full_page=True)
                # Server-level CSRF checks and durable logout, including replay of the old cookie.
                denied=context.request.post(origin+'/api/auth/logout',headers={'Origin':'https://foreign.example'},data={})
                assert denied.status==403
                old_cookie=next(cookie for cookie in context.cookies() if cookie['name']=='ss_admin')['value']
                page.get_by_role('button',name='Cerrar sesión',exact=True).click();page.wait_for_url('**/login')
                assert context.request.get(origin+'/api/products?scope=admin').status==401
                replay=context.request.get(origin+'/api/products?scope=admin',headers={'Cookie':'ss_admin='+old_cookie})
                assert replay.status==401
                summary={'status':'passed','fixture':'Synthetic JSON-LD served by httpbin.org; not a real store product','production_build':True,'image_loaded':image_loaded,'screenshots':10,'javascript_errors':errors,'mobile_overflow':False,'checks':['login error/success','private URL blocked','real server import','price preview','publish','verified alternative without silent replacement','manual identity review of candidate','monitor primary+alternatives','public projection','search/category','mobile','origin check','logout replay']}
                assert not errors,errors
                (ARTIFACTS/'ui-results.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False))
                print(json.dumps(summary,ensure_ascii=False))
                browser.close()
        finally:
            process.terminate();process.wait(timeout=10)


if __name__=='__main__':main()
