# Souvenirs Saltillo

Aplicación Next.js con catálogo público y panel administrativo para souvenirs y artículos personalizados. La integración de código incluye importación desde proveedores, persistencia y monitoreo; el primer despliegue y sus credenciales se configuran por separado.

## Lo implementado

- `/`: catálogo de productos aprobados, imágenes, precio, entrega, búsqueda y categorías.
- `/login` y `/admin`: sesión protegida, revocable y con expiración; errores de acceso y cierre de sesión.
- Importación por URL con JSON-LD o metadatos: título, descripción, imágenes, costo, moneda, entrega publicada, identidad, variantes y evidencia. Los campos ausentes quedan pendientes.
- Vista previa editable, precio sugerido con margen bruto/flete/comisiones/impuesto, precio manual, borrador y aprobación antes de publicar.
- Catálogo, sesiones y revisión persistentes en PostgreSQL. Para desarrollo o servidor con disco durable, adaptador de archivo con escritura atómica.
- Worker por lotes con lease, historial de observaciones y diferencias entre fuente retirada, bloqueada, incompleta y fallo temporal.
- Alternativas manuales y búsqueda opcional con Brave Search; selección verificada abre una nueva vista previa antes de cambiar el proveedor.
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

Seguir [docs/deployment.md](docs/deployment.md). Hosting serverless requiere PostgreSQL; no guardar el catálogo en memoria ni en disco efímero. Activar el workflow después de configurar el sitio y los secrets `MONITOR_URL` y `MONITOR_SECRET`. Los horarios se muestran en Saltillo/Ciudad de México.

La búsqueda automática requiere `SEARCH_PROVIDER=brave` y `SEARCH_API_KEY`. Sin clave, la interfaz lo indica y conserva alternativas manuales. El monitor guarda propuestas y mantiene los datos públicos aprobados; no publica cambios ni cambia proveedor de forma silenciosa.

## Alcance comprobado y límites

El bot es determinista y no utiliza un LLM. Las URLs de imágenes se aplican al catálogo; alojar copias requiere conectar almacenamiento permanente. Páginas con JavaScript obligatorio, CAPTCHA o login requieren API o un adaptador autorizado. No se infiere moneda ni entrega, ni se convierten divisas.

El precio sugerido usa margen sobre venta, no markup sobre costo. Su comisión se calcula antes de impuestos; confirmar el tratamiento fiscal del proveedor y pasarela.

No se implementaron checkout, recepción de logos, bot de atención, trazabilidad de pedidos ni recuperación de contraseña. Esos flujos continúan como desarrollo posterior, y la tienda no los anuncia como operativos.

## Documentación

- [Auditoría y cambios UI](docs/ui-audit.md).
- [Agente y reglas del catálogo](docs/supplier-agent.md).
- [Persistencia](docs/database-schema.sql).
- [Seguridad](docs/security.md).
