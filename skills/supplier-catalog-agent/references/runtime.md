# Adaptación a otros proyectos

La skill es un flujo reutilizable; no ejecuta por sí sola un cron, no instala una base ni proporciona credenciales. El runtime de referencia está en el repositorio `juliiocontreras/Souvenirs-Saltillo`.

## Piezas de referencia

- `packages/core/`: precio sugerido, modelo público, identidad de producto, validación de destinos y repositorios.
- `lib/supplier-scraper.mjs`: extracción de varias fichas/variantes con campos nulos y evidencia.
- `lib/public-fetch.mjs`: transporte HTTP restringido, reglas de robots y clasificación de errores.
- `lib/catalog-service.mjs`: borrador, edición y aplicación idempotente al catálogo.
- `lib/supplier-monitor.mjs`: leases, lotes, historial, búsqueda Brave y selección revisada de alternativas.
- `.github/workflows/supplier-monitor.yml`: ejemplo de programación cada cuatro horas.
- `docs/deployment.md`: configuración de persistencia, acceso y secretos del hosting.

Reutilizar el backend y la autenticación del proyecto receptor. El transporte y la proyección pública se adaptan a sus permisos, tipo de imagen, moneda, unidad, impuestos y tiempos. No copiar valores de credenciales ni datos de la tienda. La carpeta de skill puede instalarse sola en `~/.agents/skills/supplier-catalog-agent`; en ese caso sus scripts de runtime no se instalan automáticamente.

## Criterios de aceptación

El runtime debe demostrar: datos persistentes después de reiniciar, permiso de servidor, sesión revocable, precio con configuración explícita, campos ausentes pendientes, selección de variante, URLs públicas y redirecciones verificadas, edición antes de publicar, monitoreo con historial y recuperación de pendientes, alternativas con evidencia e identidad verificada, y catálogo público sin costos ni fuentes privadas.

Primero usar fixtures controladas para cubrir errores. Después validar al menos un proveedor real autorizado del proyecto receptor. Una página de ejemplo en un servicio HTTP permite probar extracción, pero no demuestra compatibilidad con los proveedores comerciales de la tienda.
