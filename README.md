# Souvenirs Saltillo

Aplicación Next.js con catálogo público y panel administrativo para souvenirs y artículos personalizados. Incluye importación desde proveedores, persistencia y monitoreo. [Tienda publicada](https://r1q3g0ao.basicdeploy.com) · [estado del despliegue](docs/production-state.md).

## Lo implementado

- `/`: catálogo de productos aprobados, imágenes, precio, entrega, búsqueda y categorías.
- Categorías Oficina, Equipaje, Electrónica, Deportes, Cuidado personal y Llaveros, con subcategorías y clasificación editable desde el panel.
- Asistente guiado de cotización: contacto, características, cantidad, logo, entrega, factura y urgencia; folio y seguimiento privado en el panel.
- `/login` y `/admin`: sesión protegida, revocable y con expiración; errores de acceso y cierre de sesión.
- Importación por URL con JSON-LD o metadatos: título, descripción, imágenes, costo, moneda, entrega publicada, identidad, variantes y evidencia. Los campos ausentes quedan pendientes.
- Vista previa editable, precio sugerido con margen bruto/flete/comisiones/impuesto, precio manual, borrador y aprobación antes de publicar.
- Catálogo, sesiones y revisión persistentes en PostgreSQL. Para desarrollo o servidor con disco durable, adaptador de archivo con escritura atómica.
- Worker por lotes con lease, historial de observaciones y diferencias entre fuente retirada, bloqueada, incompleta y fallo temporal.
- Alternativas manuales y búsqueda opcional con Tavily; selección verificada abre una nueva vista previa antes de cambiar el proveedor.
- Workflow de GitHub Actions cada cuatro horas y comando `npm run monitor:suppliers`.
- [Skill reutilizable](skills/supplier-catalog-agent/SKILL.md) para adaptar este flujo a otros proyectos.

## Ejecutar

Requiere Node **22.19 o posterior**.

```bash
npm ci
# Copiar .env.example a .env.local y configurar contraseña, secretos y APP_ORIGIN.
npm run dev
```

Abrir `http://localhost:3000`, con ese mismo valor en `APP_ORIGIN`. Nunca subir `.env.local`, el catálogo privado ni credenciales a Git.

```bash
npm test
npm run build
npm run monitor:suppliers -- --force
```

Las pruebas de PostgreSQL se activan con `TEST_DATABASE_URL` sobre una base **temporal exclusiva de pruebas**. CI levanta y elimina PostgreSQL automáticamente. La verificación de navegador opcional es `python3 scripts/ui-smoke.py`, con Playwright y Chromium en `/usr/bin/chromium`; usa credenciales temporales y fichas sintéticas servidas por HTTPbin. No se crean productos de demostración en la base del usuario.

## Primer despliegue

Seguir [docs/deployment.md](docs/deployment.md). El sitio actual utiliza PostgreSQL y el scheduler de BasicDeploy; el cron de GitHub permanece desactivado. Tavily ya está conectado en producción. Hosting serverless requiere PostgreSQL; no guardar el catálogo en memoria ni en disco efímero. Los horarios se muestran en Saltillo/Ciudad de México.

La búsqueda automática usa `SEARCH_PROVIDER=tavily` y `SEARCH_API_KEY`, con búsquedas básicas de un crédito. El límite `SEARCH_MONTHLY_LIMIT=900` se reserva en PostgreSQL antes de cada intento, incluidos fallos; no supera 900 aunque se configure un valor mayor. Al agotarse se pausa únicamente la búsqueda hasta el siguiente mes UTC: el monitor de enlaces sigue funcionando. Sin clave, el panel lo indica y conserva alternativas manuales. Brave sigue disponible como adaptador opcional. El monitor guarda propuestas y mantiene los datos públicos aprobados; no publica cambios ni cambia proveedor de forma silenciosa.

## Alcance comprobado y límites

El rastreador y el asistente de cotización son deterministas y no utilizan un LLM. El asistente recibe solicitudes a cualquier hora mientras la tienda está disponible; el hosting gratuito puede suspenderse y despertar con tráfico. Las URLs de imágenes de proveedores se aplican al catálogo; alojar copias requiere conectar almacenamiento permanente. Páginas con JavaScript obligatorio, CAPTCHA o login requieren API o un adaptador autorizado. No se infiere moneda ni entrega, ni se convierten divisas.

El precio sugerido usa margen sobre venta, no markup sobre costo. Su comisión se calcula antes de impuestos; confirmar el tratamiento fiscal del proveedor y pasarela.

El asistente guarda cotizaciones y logos privados de hasta 1 MB en PostgreSQL. El administrador consulta solicitudes, descarga logos y registra su seguimiento; atiende al cliente por el medio elegido. La cotización no confirma una compra, existencias ni una fecha de entrega. Checkout, trazabilidad de pedidos y recuperación de contraseña continúan como desarrollo posterior.

## Documentación

- [Auditoría y cambios UI](docs/ui-audit.md).
- [Agente y reglas del catálogo](docs/supplier-agent.md).
- [Categorías, personalización y cotizaciones](docs/catalog-and-quotes.md).
- [Persistencia](docs/database-schema.sql).
- [Seguridad](docs/security.md).
