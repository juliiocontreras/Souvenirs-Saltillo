# Netlify Free y Neon Free

Esta es la alternativa preparada para usar `suvenirssaltillo.shop` con el dominio
raíz y `www`, sin contratar un plan de pago. La configuración `netlify.toml`
usa Node 22, `npm run build` y el adaptador mantenido de Next.js que instala
Netlify. El catálogo, las sesiones y los logos permanecen en PostgreSQL.

## Cuentas y límites

Usar un equipo **Free** de Netlify y un proyecto **Free** de Neon. Comprobar el
plan antes de crear recursos: un equipo o una organización de pago existente
puede tener otra política de cobro. No habilitar recargas, upgrades ni pago por uso.

Según las páginas oficiales revisadas el 17 de octubre de 2026, Netlify Free
incluye dominio/SSL, funciones y 300 créditos mensuales con límite estricto;
Neon Free incluye 1 GB por proyecto y 100 CU-horas mensuales. Al agotarse cuotas
puede pausarse el servicio; esta opción no ofrece una garantía de atención 24/7.
Confirmar las condiciones de cada cuenta antes de activarla.

- [Netlify: planes y límite gratuito](https://www.netlify.com/pricing/).
- [Compatibilidad con Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).
- [Neon: planes](https://neon.com/docs/introduction/plans).

Render Free también admite dominio/SSL, pero se suspende a los 15 minutos sin
tráfico y su documentación desaconseja usar instancias gratuitas en producción.
Por eso se preparó Netlify para este proyecto. La base de BasicDeploy es interna
a su contenedor; no se puede reutilizar su URL directamente desde Netlify.

## Preparar sin cambiar el sitio actual

1. Autorizar la CLI oficial de Netlify con el enlace de acceso que genera
   `netlify login --request`. La autorización se completa en el proveedor;
   nunca enviar contraseñas, tokens ni cadenas de conexión por chat.
2. Crear un proyecto vacío y **Free** en Neon, PostgreSQL 17. Guardar la cadena
   de conexión en las variables privadas del sitio Netlify. Usar TLS verificado
   y la conexión con pooling indicada por Neon para la aplicación.
3. Importar el repositorio de GitHub en un equipo **Free** de Netlify, rama
   `main`. El archivo `netlify.toml` define la compilación. Deshabilitar la
   publicación automática mientras se prepara la migración y el dominio.
4. En la configuración privada del sitio, ámbito **Functions**, contexto
   **Production**, establecer:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | Conexión privada a Neon, con TLS verificado |
   | `APP_ORIGIN` | URL temporal real `https://<sitio-asignado>.netlify.app` para probar |
   | `ADMIN_PASSWORD` | Contraseña del propietario, mínimo 12 caracteres |
   | `AUTH_SECRET` | Nuevo secreto aleatorio, mínimo 32 caracteres |
   | `MONITOR_SECRET` | Secreto independiente, mínimo 32 caracteres |
   | `MONITOR_WEB_MODE` | `light` |
   | `MONITOR_BATCH_SIZE` | `1` |
   | `MONITOR_SCHEDULER_CONFIGURED` | `false` hasta verificar el workflow |
   | `SEARCH_PROVIDER` | `tavily` |
   | `SEARCH_API_KEY` | Clave de Tavily existente, privada |
   | `SEARCH_MONTHLY_LIMIT` | `900` |

   Las variables de compilación en TOML no sustituyen las variables de Functions.
   Mantener `CATALOG_DATA_FILE` vacío: el disco serverless es efímero. No compartir
   credenciales ni datos de producción con deploy previews.

## Copiar el estado persistente

Para publicar desde la CLI, ejecutar `netlify deploy --prod --context production`
con la compilación habilitada. El adaptador de Next.js ajusta el directorio de
publicación a `.netlify/static` e incluye imágenes, CSS y JavaScript junto al
servidor. No publicar `.next` directamente con `--no-build`: el servidor puede
responder mientras los archivos públicos devuelven 404 y la página queda sin
estilos ni controles interactivos.

Si la compilación se hizo por separado, usar `netlify build --offline --context
production` y después `netlify deploy --prod --no-build --dir .netlify/static`.
Comprobar que los artefactos del servidor también están preparados. Si Netlify
rechaza la publicación por cuota agotada, detener los intentos: cambiar el
directorio no resuelve ese bloqueo. La alternativa preparada está en
[Render Free](render-free.md).

Preparar un respaldo privado de las dos tablas antes del traslado. Detener las
escrituras de la aplicación de origen y su scheduler durante la copia y el
cambio de dominio; mantenerlos detenidos hasta terminar para evitar divergencias.
El flag del comando confirma que el operador realizó ese paso: no detiene
automáticamente la aplicación antigua.

Ejecutar desde un entorno que pueda alcanzar ambas bases. BasicDeploy proporciona
una conexión interna, por lo que normalmente se ejecuta desde su contenedor.
El paquete standalone incluye `ops/migrate-database.mjs` y sus dependencias.
Introducir `SOURCE_DATABASE_URL` y `TARGET_DATABASE_URL` en el entorno privado y
ejecutar con Node 22:

```bash
node ops/migrate-database.mjs --source-writes-stopped
```

La copia usa una instantánea consistente y una transacción en el destino.
Rechaza un destino ocupado. Conserva productos, checks, alternativas, borradores,
historial, consumo mensual de búsqueda, contacto público, cotizaciones y logos.
Omite sesiones, contadores de acceso y leases para que el nuevo servidor empiece
sin accesos ni trabajos antiguos. Los logs muestran únicamente cantidades. La
base de origen se consulta en modo de solo lectura. Un fallo revierte la copia
del destino; nunca se elimina el origen.

## Monitor de cuatro horas fuera de las funciones web

El workflow `Supplier monitor` conserva el horario `17 */4 * * *` UTC. Para que
el worker procese lotes completos sin el límite de las funciones web de Netlify:

1. Guardar en los **Actions secrets** de este repositorio `MONITOR_DATABASE_URL`
   (conexión privada a la misma base Neon) y `SEARCH_API_KEY` (Tavily).
2. Configurar las **Actions variables** `MONITOR_TRANSPORT=database` y, después
   de desactivar el scheduler antiguo, `MONITOR_ENABLED=true`.
3. Ejecutar manualmente el workflow y verificar una revisión completada en el
   panel. Entonces establecer `MONITOR_SCHEDULER_CONFIGURED=true` en Netlify.

El transporte HTTP anterior se conserva si no se selecciona `database`. El
workflow impide ejecuciones concurrentes y el worker mantiene sus leases y
cuotas. Sus logs muestran cantidades, sin identificadores privados de productos.
GitHub puede retrasar o desactivar cron por inactividad; el historial del panel
es la comprobación de las ejecuciones, no solo la configuración del horario.

Con `MONITOR_WEB_MODE=light`, **Revisar proveedores** procesa un enlace por
solicitud web y deja la búsqueda de nuevos proveedores al workflow. Así la
revisión completa no depende de mantener abierta una función web. El modo
normal se conserva en otros servidores.

## Conectar GoDaddy y validar

1. Tras probar el despliegue temporal, registrar `suvenirssaltillo.shop` y `www`
   en **Domain management** del proyecto Netlify. Seleccionar el dominio raíz
   como principal y usar los registros exactos que muestre ese proyecto.
2. En GoDaddy, sustituir `A @ = Parked` por el destino indicado por Netlify. Su
   documentación general indica `75.2.60.5` para el balanceador estándar; usarlo
   solamente si coincide con las instrucciones del proyecto. Cambiar `CNAME www`
   al nombre real `<sitio-asignado>.netlify.app` indicado por Netlify. Conservar
   NS, SOA, correo y verificaciones existentes.
3. Esperar la verificación DNS y el certificado HTTPS de ambos nombres. Entonces
   cambiar `APP_ORIGIN=https://suvenirssaltillo.shop` en Functions y volver a
   desplegar. Confirmar redirección de `www` al dominio principal.
4. Probar login/logout, catálogo, WhatsApp, cotización con logo, folio, descarga
   privada del logo y rechazo de escrituras desde otro origen. Confirmar el
   historial del monitor y que las cuotas de búsqueda se conservaron.
5. Habilitar la publicación automática de `main` tras verificar el traslado.
   Conservar el respaldo y el servidor anterior para una reversión coordinada;
   mantener un único servidor con escrituras y un único scheduler activos.

[DNS externo en Netlify](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).

## Estado

Configuración y herramientas preparadas; la creación/autorización de recursos,
la copia real y el cambio DNS deben verificarse antes de anunciar el dominio
como conectado. El despliegue de BasicDeploy sigue siendo el entorno anterior.
