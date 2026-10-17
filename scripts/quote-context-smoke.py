"""Check product/category quote flows against a build using isolated synthetic data.

Run npm run build first, then python3 scripts/quote-context-smoke.py.
Requires Python Playwright and /usr/bin/chromium. Never touches production data.
"""
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'quote-context'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    password = secrets.token_urlsafe(24)
    errors = []
    with tempfile.TemporaryDirectory(prefix='saltillo-context-') as folder, (OUT / 'server.log').open('w') as log:
        catalog = Path(folder) / 'catalog.json'
        catalog.write_text(json.dumps({'products': {'fixture': {
            'id': 'fixture', 'status': 'published', 'title': 'Mochila de prueba',
            'description': 'Ficha sintética exclusiva del entorno de prueba.',
            'category': 'Equipaje', 'subcategory': 'Mochilas', 'publicPrice': 299,
            'currency': 'MXN', 'supplierCost': 123, 'supplierUrl': 'https://supplier.example.test/private',
            'images': ['/images/backpack-hero.webp'], 'personalizationSupported': True,
        }}}))
        catalog.chmod(0o600)
        env = dict(os.environ, NODE_ENV='production', DATABASE_URL='', CATALOG_DATA_FILE=str(catalog),
                   APP_ORIGIN=origin, ADMIN_PASSWORD=password, AUTH_SECRET=secrets.token_hex(32),
                   WHATSAPP_NUMBER='', SEARCH_PROVIDER='', SEARCH_API_KEY='', NEXT_TELEMETRY_DISABLED='1')
        server = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', str(port)],
                                  cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            with sync_playwright() as driver:
                browser = driver.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
                context = browser.new_context(viewport={'width': 1440, 'height': 1000})
                page = context.new_page()
                page.set_default_timeout(15000)
                page.on('pageerror', lambda error: errors.append(str(error)))
                for _ in range(60):
                    try:
                        page.goto(origin + '/?categoria=Oficina&subcategoria=Plumas#catalogo', wait_until='networkidle')
                        break
                    except Exception:
                        time.sleep(.2)
                page.get_by_role('button', name='Solicitar información', exact=True).click()
                page.get_by_label('Nombre', exact=True).fill('Cliente de prueba')
                page.get_by_label('Contacto preferido', exact=True).select_option('Correo')
                page.get_by_label('Correo', exact=True).fill('cliente@example.test')
                page.get_by_role('button', name='Continuar', exact=True).click()
                assert page.get_by_label('Categoría', exact=True).input_value() == 'Oficina'
                assert page.get_by_label('Tipo de artículo', exact=True).input_value() == 'Plumas'
                page.get_by_label('Cantidad de piezas', exact=True).fill('50')
                page.get_by_label('Características del pedido', exact=True).fill('Color beige y bordado dorado')
                page.get_by_role('button', name='Cerrar asistente', exact=True).click()
                page.get_by_role('button', name='Equipaje', exact=True).click()

                def product_quote():
                    page.get_by_role('button', name='Ver detalles de Mochila de prueba', exact=True).click()
                    assert page.get_by_role('button', name='Cotizar este artículo', exact=True).is_visible()
                    page.get_by_role('button', name='Cotizar este artículo', exact=True).click()
                    assert page.locator('dialog[open]').count() == 1
                    assert page.evaluate('document.body.style.overflow') == 'hidden'

                product_quote()
                page.locator('.sf-quote-context').wait_for()
                page.locator('.sf-quote-dialog').screenshot(path=str(OUT / 'selection-desktop.png'))
                for width in [390, 768, 1440]:
                    page.set_viewport_size({'width': width, 'height': 900})
                    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
                    assert page.locator('.sf-quote-body').evaluate('(node)=>node.scrollWidth<=node.clientWidth')
                page.set_viewport_size({'width': 390, 'height': 844})
                page.locator('.sf-quote-dialog').screenshot(path=str(OUT / 'selection-mobile.png'))
                page.get_by_role('button', name='Continuar mi solicitud', exact=True).click()
                assert page.get_by_label('Categoría', exact=True).input_value() == 'Oficina'
                assert page.get_by_label('Características del pedido', exact=True).input_value() == 'Color beige y bordado dorado'
                page.get_by_role('button', name='Cerrar asistente', exact=True).click()
                page.set_viewport_size({'width': 1440, 'height': 1000})
                product_quote()
                page.get_by_role('button', name='Usar esta selección', exact=True).click()
                assert page.get_by_label('Categoría', exact=True).input_value() == 'Equipaje'
                assert page.get_by_label('Tipo de artículo', exact=True).input_value() == 'Mochilas'
                assert page.get_by_label('Cantidad de piezas', exact=True).input_value() == '50'
                assert page.get_by_label('Características del pedido', exact=True).input_value() == 'Me interesa cotizar: Mochila de prueba.\n\nColor beige y bordado dorado'
                page.get_by_role('button', name='Atrás', exact=True).click()
                assert page.get_by_label('Nombre', exact=True).input_value() == 'Cliente de prueba'
                assert page.get_by_label('Correo', exact=True).input_value() == 'cliente@example.test'
                page.get_by_role('button', name='Continuar', exact=True).click()
                page.get_by_role('button', name='Continuar', exact=True).click()
                page.get_by_label('Logo o diseño', exact=True).select_option('Sin logo')
                page.get_by_label('La fecha está por definir', exact=True).check()
                page.get_by_label('Ciudad y estado de entrega', exact=True).fill('Saltillo, Coahuila')
                page.get_by_label('Nivel de urgencia', exact=True).select_option('Urgente')
                page.get_by_label('¿Necesitas factura?', exact=True).select_option('Sí')
                page.get_by_role('button', name='Continuar', exact=True).click()
                page.get_by_label('Autorizo a Souvenirs Saltillo', exact=False).check()
                with page.expect_response(lambda response: response.url.endswith('/api/quotes') and response.request.method == 'POST') as received:
                    page.get_by_role('button', name='Enviar solicitud', exact=True).click()
                response = received.value
                assert response.status == 201
                receipt = response.json()['receipt']
                assert set(receipt) == {'id', 'reference', 'createdAt'}
                page.get_by_text(receipt['reference'], exact=True).wait_for()
                saved = json.loads((Path(folder) / 'quote-requests.json').read_text())['quotes'][receipt['id']]
                assert saved['category'] == 'Equipaje' and saved['subcategory'] == 'Mochilas'
                assert saved['quantity'] == 50 and saved['invoice'] == 'Sí' and saved['urgency'] == 'Urgente'
                assert 'Mochila de prueba' in saved['description'] and 'bordado dorado' in saved['description']
                assert 'supplierCost' not in saved and 'supplierUrl' not in saved
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
                page.get_by_role('button', name='Cerrar asistente', exact=True).click()
                product_quote()
                # A completed receipt must not prevent a fresh product quote.
                assert page.get_by_label('Nombre', exact=True).input_value() == ''
                assert page.get_by_role('button', name='Continuar', exact=True).is_visible()
                page.get_by_role('button', name='Cerrar asistente', exact=True).click()
                page.goto(origin + '/?categoria=Equipaje&subcategoria=Mochilas#cotizar', wait_until='networkidle')
                page.get_by_label('Nombre', exact=True).fill('Segunda consulta')
                page.get_by_label('Contacto preferido', exact=True).select_option('Correo')
                page.get_by_label('Correo', exact=True).fill('segundo@example.test')
                page.get_by_role('button', name='Continuar', exact=True).click()
                assert page.get_by_label('Categoría', exact=True).input_value() == 'Equipaje'
                assert page.get_by_label('Tipo de artículo', exact=True).input_value() == 'Mochilas'
                assert not errors, errors
                browser.close()
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
    result = {'status': 'passed', 'javascript_errors': errors, 'checks': [
        'empty category prefill', 'contact first', 'product quote CTA', 'single modal and scroll lock',
        'explicit draft preservation', 'category/subcategory and product title', 'contact and requirements retained',
        'mobile/tablet overflow', 'successful persisted quote', 'private supplier fields absent',
        'receipt followed by fresh product quote', 'direct hash link context',
    ]}
    (OUT / 'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
