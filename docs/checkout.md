# Checkout con Stripe

Venta directa con carrito, Stripe Checkout alojado, pago único, productos
físicos, MXN. Cuenta de Stripe: **tapmkt** (live). El catálogo de producción
está vacío: no se puede vender (ni probar una compra real) hasta que se
publique el primer producto desde el panel.

## Flujo completo

1. El cliente agrega productos al carrito (botón en cada tarjeta y en el
   detalle del producto). El carrito vive en `localStorage`
   (`souvenirs-cart-v1`) y guarda **solo id + cantidad**; los precios no se
   guardan en el navegador.
2. Al pulsar **Pagar con tarjeta**, el carrito llama a `POST /api/checkout`
   con `[{ id, qty }]`.
3. El servidor revalida el carrito contra el catálogo **publicado**
   (`lib/checkout-service.mjs` + `packages/core/orders.mjs`): solo productos
   con `status: "published"`, precio numérico mayor que cero y moneda MXN.
   Un precio manipulado en el navegador nunca llega a Stripe: el servidor
   recalcula cada línea desde `publicPrice` (pesos) y la convierte a
   centavos (`pesosToCents`).
4. Se crea una sesión de Stripe Checkout con los line items, dos opciones de
   entrega (ver Envío) y `shipping_address_collection` limitado a MX. El
   cliente paga en la página alojada de Stripe.
5. Éxito → `/checkout/success?session_id=...`: muestra el resumen si el
   webhook ya registró el pedido y vacía el carrito. Cancelación →
   `/checkout/cancel`: no se cobra nada y el carrito se conserva.
6. Stripe envía `checkout.session.completed` a `POST /api/stripe/webhook`.
   El webhook verifica la firma con `STRIPE_WEBHOOK_SECRET`, registra el
   evento (idempotencia) y guarda el pedido como **pagado** con snapshot de
   artículos, cliente, dirección y método de entrega.
7. Los pedidos se ven en el panel de admin, sección **Pedidos**
   (`GET /api/orders`, solo admin).

## Variables de entorno

| Variable | Dónde | Descripción |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Render → Environment | Clave secreta de Stripe (cuenta tapmkt, live). Sin ella, `/api/checkout` responde 503. |
| `STRIPE_WEBHOOK_SECRET` | Render → Environment | Secreto del webhook (`whsec_...`) del endpoint de `https://suvenirssaltillo.shop/api/stripe/webhook`. Sin él, el webhook responde 503. |
| `SHIPPING_FLAT_RATE_MXN_CENTS` | Render → Environment | Tarifa plana de envío en centavos. Por defecto `15000` ($150 MXN). Ver Envío. |

Las tres están declaradas en `render.yaml` (`sync: false` para las claves;
el valor por defecto de envío es `"15000"`). Las claves **nunca** se guardan
en archivos ni en el repositorio.

## Supuestos (pendientes de confirmación por Julio)

### IVA incluido

`TAX_INCLUDED = true` en `packages/core/orders.mjs`: los precios del
catálogo (`publicPrice`) **ya incluyen IVA** y el checkout no agrega ninguna
línea de impuesto. Si Julio decide desglosar el IVA, el cambio se hace en
ese módulo (poner `TAX_INCLUDED` en `false` y agregar la línea de impuesto
en la sesión de Checkout / Stripe Tax).

### Envío: $150 MXN por confirmar

La sesión de Checkout ofrece dos opciones:

- **Recoger en Saltillo** — gratis.
- **Envío a todo México** — tarifa plana de
  `SHIPPING_FLAT_RATE_MXN_CENTS`, por defecto **15000 centavos ($150 MXN)**.
  **Este valor es un supuesto y está pendiente de confirmación por Julio.**

La dirección de envío solo se cobra cuando el cliente elige envío (Stripe
la pide únicamente para esa opción) y el destino está restringido a México
(`shipping_address_collection: { allowed_countries: ["MX"] }`). El método
de entrega del pedido se deriva de lo que cobró Stripe:
`shipping_cost.amount_total > 0` → `shipping`; en caso contrario `pickup`.

## Pedidos y base de datos

El repo no usa migraciones automáticas: el esquema vive en
`docs/database-schema.sql` y las tablas se crean solas al primer uso
(`PostgresOrderRepository.initialize()` con `CREATE TABLE IF NOT EXISTS`).
Dos tablas nuevas, con los datos en `jsonb` (mismo estilo que las
cotizaciones en `souvenirs_quote_requests`):

- `souvenirs_orders (id uuid PRIMARY KEY, data jsonb NOT NULL)` — un pedido
  por sesión de checkout pagada. Campos en `data`: `id`,
  `stripeSessionId`, `stripePaymentIntent`, `status` (`paid`), `totalCents`,
  `currency` (`MXN`), `items` (snapshot: `id`, `title`, `unitPriceCents`,
  `quantity`, `lineTotalCents`), `customer` (`name`, `email`), `shipping`
  (`name`, `address`), `deliveryMethod` (`pickup` / `shipping`),
  `createdAt`, `updatedAt`.
- `souvenirs_stripe_events (id text PRIMARY KEY, data jsonb NOT NULL)` —
  eventos de Stripe ya procesados, para idempotencia. El `id` es el ID de
  evento de Stripe (`evt_...`).

En desarrollo (sin `DATABASE_URL`) los pedidos y eventos viven en
`.data/orders.json`, junto a `.data/catalog.json`.

La copia de base de datos (`ops/database-copy.mjs`, `migrateStore`) ya
incluye ambas tablas; `tests/database-migration.test.mjs` lo cubre.

### Idempotencia del webhook

1. Si el ID de evento ya está en `souvenirs_stripe_events`, se responde
   `{ duplicate: true }` sin tocar nada.
2. Si el evento es nuevo pero la sesión ya tiene pedido
   (`getOrderBySession`), se actualiza ese mismo pedido en lugar de crear
   otro.
3. El evento se registra **después** de procesar: si el proceso falla,
   Stripe reintentará la entrega y el evento se procesará entonces.

## Qué falta para el pase a producción

1. **Publicar el primer producto** en el panel (importación → publicar).
   Sin productos publicados el checkout responde 422.
2. **Poner las claves en Render** (servicio `suvenirssaltillo`, cuenta
   `contacto@suvenirssaltillo.shop` → Environment):
   `STRIPE_SECRET_KEY` (clave secreta live de tapmkt) y
   `STRIPE_WEBHOOK_SECRET` (ver paso 3).
3. **Crear el webhook en Stripe** (cuenta tapmkt, Developers → Webhooks):
   endpoint `https://suvenirssaltillo.shop/api/stripe/webhook`, evento
   `checkout.session.completed` (basta ese evento; otros se registran y se
   ignoran). Copiar el secreto de firma (`whsec_...`) a Render.
4. **Confirmar los dos supuestos**: tarifa de envío ($150 MXN por defecto)
   y que los precios ya incluyen IVA.
5. **Compra de prueba real**: comprar el producto más barato publicado,
   verificar que el pedido aparece como pagado en el panel y que el cargo
   se ve en Stripe; después **reembolsar** la compra de prueba.
6. Render redespliega solo con el push a `main` (auto-deploy). No hay que
   tocar la base de datos a mano: las tablas se crean solas al primer uso.

## Archivos

- Carrito: `packages/core/cart.mjs`, `app/components/storefront/Cart.js`,
  `app/components/storefront/ClearCart.js`.
- Checkout: `packages/core/orders.mjs`, `lib/checkout-service.mjs`,
  `lib/stripe-client.mjs`, `lib/order-store.mjs`,
  `packages/core/order-repository.mjs`, `app/api/checkout/route.js`,
  `app/api/stripe/webhook/route.js`, `app/api/orders/route.js`,
  `app/checkout/success/page.js`, `app/checkout/cancel/page.js`.
- Pedidos en admin: `app/components/OrderList.js` (sección Pedidos en
  `app/components/AdminPanel.js`).
- Tests: `tests/cart.test.mjs`, `tests/checkout.test.mjs`,
  `tests/orders.test.mjs`.
