# Primer despliegue de Souvenirs Saltillo

El repositorio integra tienda, login, panel y bot en una aplicación Next.js. El primer
sitio está publicado en BasicDeploy; consultar [production-state.md](production-state.md)
para el estado verificado y el paso pendiente de Tavily. Esta guía permite
reproducir la configuración en otro entorno.

## Desarrollo local

1. `npm ci` con Node 22.19 o posterior.
2. Copiar `.env.example` a `.env.local` y configurar `ADMIN_PASSWORD` (al menos 12 caracteres), `AUTH_SECRET` (al menos 32 caracteres independientes) y `MONITOR_SECRET` (al menos 32 caracteres independientes).
3. Usar `APP_ORIGIN=http://localhost:3000` y ejecutar `npm run dev`. Abrir el mismo origen en el navegador.
4. Acceder a `/login`, importar una URL y revisar la ficha. Datos ausentes quedan pendientes; aprobar y publicar solo después de confirmar condiciones. La tienda muestra exclusivamente productos publicados.

Sin `DATABASE_URL`, desarrollo conserva catálogo, sesiones e historial en `.data/catalog.json`, con escritura atómica y lock entre procesos. No guardar ese archivo en Git ni compartirlo como evidencia. Para migrar datos locales a PostgreSQL debe ejecutarse una migración revisada; configurar la base no copia datos automáticamente.

## Hosting de Next.js

### BasicDeploy: paquete standalone

El proyecto genera `.next/standalone`. Compilar fuera del contenedor gratuito (256 MB),
copiar `.next/static` dentro de ese paquete y, si existe, `public`. Incluir
`ops/basicdeploy-boot.sh` y publicar el archivo con un checksum SHA-256. No incluir
archivos `.env`, datos, credenciales ni logs en el paquete.

El workflow **Package production** compila y publica ese paquete con checksum en
GitHub Releases después de un CI exitoso de `main`, usando el mismo commit
verificado. También puede ejecutarse manualmente desde `main`. No contiene secretos
del hosting ni publica el sitio automáticamente. `python3 ops/package-production.py`
empaqueta también un build local.

Instalar Node 22.19 o posterior dentro de `/workspace/node`, verificando el checksum
oficial. Usar el `DATABASE_URL` que proporciona el contenedor; no imprimirlo ni cambiar
su conexión interna por una conexión pública sin TLS.

Guardar secretos independientes en `/workspace/saltillo-private.env` con permisos 600.
El build se instala en un directorio de release y `/workspace/saltillo/current` apunta
a la versión activa. Crear `/workspace/.bd_boot.sh` ejecutable que invoque
`/workspace/saltillo/current/ops/basicdeploy-boot.sh`. Ese script carga las variables
privadas, evita procesos duplicados y escucha en `0.0.0.0:8080`. BasicDeploy ejecuta
el hook al despertar/reiniciar; guardar los logs en un archivo privado del contenedor.

Probar HTTPS, login/logout, acceso privado, base de datos e importación; después
disparar el workflow de monitoreo y activar `MONITOR_ENABLED` siguiendo los pasos
inferiores. El plan gratuito no admite dominio propio. No activar un complemento
de pago sin autorización. Conservar la versión previa para poder revertir el release.

El hook también inicia `ops/monitor-scheduler.py`. Este worker llama al endpoint
local con `MONITOR_SECRET` cada cuatro horas (minuto 17 UTC), guarda la última
ejecución completada fuera del release y retoma la revisión pendiente tras reiniciar.
No habilitar simultáneamente el cron de GitHub. Si el hosting duerme o está caído,
el worker se detiene y recupera la revisión al despertar; se necesita un plan
sin suspensión para garantizar ejecución aun sin tráfico. Verificar el estado
del plan antes de anunciar disponibilidad continua.

El servidor Next.js escucha solo en loopback `8081`. `ops/http-entry.mjs` sirve el
puerto público `8080` y entrega HTML completo con longitud conocida, limitado a
8 MB. Normaliza el cierre de `title` usando espacio opcional válido en HTML:
el hosting inyectaba otro aviso después del cierre literal y producía un `<head>`
inválido. El aviso normal del pie permanece visible. JSON y archivos se transmiten
directamente, conservando las cookies y los encabezados de autenticación.

Configurar `MONITOR_SCHEDULER_CONFIGURED=true` después de instalar el scheduler:
el panel mostrará que está programado y conservará el historial de ejecuciones
como evidencia independiente. La variable por sí sola no ejecuta el monitor.

Para habilitar búsqueda, crear una cuenta y una clave en Tavily API. Desde la
terminal del contenedor ejecutar `python3 /workspace/saltillo/current/ops/configure-search.py`.
El comando solicita la clave sin mostrarla, verifica autenticación y plan gratuito
mediante `/usage` sin ejecutar una búsqueda, rechaza planes de pago o pago por uso
y la guarda en el archivo privado antes de reiniciar únicamente este servidor. Revisar las
condiciones/cuota del plan de Tavily antes de generar la clave. No compartirla por chat.

La aplicación puede desplegarse en Vercel u otro hosting que soporte Next.js y funciones Node. Para hosting serverless configurar PostgreSQL persistente; no usar un archivo en disco efímero.

Variables del servidor:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Base PostgreSQL del proyecto, con el modo SSL verificado indicado por el proveedor. Nunca en una variable `NEXT_PUBLIC_*`. |
| `APP_ORIGIN` | Origen HTTPS real del panel, sin ruta ni barra final. Todas las escrituras de navegador verifican `Origin`. |
| `ADMIN_PASSWORD` | Contraseña de administración, de al menos 12 caracteres. |
| `AUTH_SECRET` | Secreto aleatorio independiente de al menos 32 caracteres para firmar sesiones. |
| `MONITOR_SECRET` | Secreto independiente de al menos 32 caracteres para el scheduler. |
| `DEFAULT_MARGIN_PERCENT` | Margen bruto inicial editable; predeterminado 40, no markup sobre el costo. |
| `SEARCH_PROVIDER` | `tavily` para activar búsqueda automática, opcional. |
| `SEARCH_API_KEY` | Clave de Tavily, opcional y solo en servidor. |
| `SEARCH_MONTHLY_LIMIT` | Consultas reservadas por mes UTC de esta tienda, de 0 a 900; predeterminado 900. |
| `MONITOR_BATCH_SIZE` | Enlaces por lote, predeterminado 2 y máximo 5. |

El adaptador crea `souvenirs_catalog_records` en la base del proyecto. El rol del servidor necesita permisos para crear esa tabla inicialmente y operar sus registros. Ver `database-schema.sql`. El pool, los locks transaccionales y las consultas quedan exclusivamente en servidor.

Para un servidor Node con volumen durable, `CATALOG_DATA_FILE` puede sustituir a PostgreSQL. En producción, si falta tanto PostgreSQL como un archivo explícito, las operaciones no empiezan a guardar datos en memoria ni en un disco temporal de forma silenciosa.

Usar HTTPS para cookies `Secure`. Rotar `ADMIN_PASSWORD` o `AUTH_SECRET` invalida las sesiones previas. Cerrar sesión elimina el registro persistente y bloquea reutilizar el mismo token.

## Monitoreo cada cuatro horas

Una vez que el sitio y la base funcionen, configurar estos **secrets del repositorio** en GitHub → Settings → Secrets and variables → Actions:

- `MONITOR_URL`: `https://<tu-origen>/api/supplier/monitor`.
- `MONITOR_SECRET`: exactamente el mismo secreto del servidor.

El workflow `Supplier monitor` ya apunta al endpoint implementado. Programa `17 */4 * * *` en UTC: **02:17, 06:17, 10:17, 14:17, 18:17 y 22:17 en Saltillo/Ciudad de México**. GitHub puede retrasar una ejecución; los timestamps pendientes y los resultados quedan en la base.

El workflow procesa lotes hasta terminar, con límite de 30 minutos/100 lotes y reporte de pendientes. La ruta necesita hasta 300 segundos por solicitud. El hosting debe permitir ese tiempo; algunos planes requieren ajustar lotes o usar un worker persistente. No se anuncia monitoreo activo solo porque haya un cron en el repositorio.

Ejecutar primero `workflow_dispatch` desde Actions. Verificar que se complete y que el panel muestre una ejecución real. El monitor revisa enlaces principales y alternativas, conserva los datos aprobados y registra observaciones. Cambios de precio, contenido, entrega o moneda se aprueban mediante reimportación; ningún proveedor se sustituye automáticamente.

Después de comprobar esa ejecución, configurar la variable de repositorio **`MONITOR_ENABLED=true`** en Actions. Las ejecuciones programadas se omiten mientras no se active esa variable; el disparo manual sigue disponible para verificar el primer despliegue.

Como alternativa al workflow, usar `npm run monitor:suppliers` desde un cron o job del mismo hosting con la misma base y variables. `npm run monitor:suppliers -- --force` solicita revisión inmediata. No configurar dos schedulers deliberadamente: el lease evita solapamientos, pero conviene una sola programación.

## Límites y validación con proveedores reales

- El bot determinista usa JSON-LD y Open Graph. Páginas con JavaScript obligatorio, CAPTCHA o login necesitan API/feed o un adaptador autorizado; no se eluden controles del proveedor.
- Verifica HTTP/HTTPS públicos, IPv4/IPv6, DNS, redirecciones, tiempos, tamaños y `robots.txt`. En salida directa fija la IP resuelta; cuando se usa un proxy confiable, ese proxy también debe bloquear destinos privados y cambios de DNS. Conserva TLS y no reenvía claves de búsqueda por redirecciones.
- Imágenes se aplican como URLs. Verificar permiso y funcionamiento del hotlink; alojar copias requiere conectar almacenamiento permanente. No se han añadido archivos ni credenciales del proveedor al repositorio.
- Precio y moneda ausentes no se convierten en cero ni se infieren como MXN. Entrega ausente permanece pendiente; no se convierten divisas. El cálculo incluye costo unitario, flete, comisiones e impuesto configurados.
- Alternativas se verifican por identificadores publicados (GTIN o marca/modelo y variante). Es una coincidencia de ficha, no una garantía de legitimidad del vendedor. Homologar cantidades, unidad, moneda, envío e impuestos antes de comparar costos.
- Si faltan identificadores, el administrador puede confirmar expresamente que la ficha corresponde al mismo artículo y abrir la vista previa. Un GTIN que contradiga al original bloquea la sustitución incluso con confirmación manual.
- No se implementó checkout, recepción de logos ni recuperación de contraseña. El catálogo evita anunciar esos flujos como si estuvieran disponibles.

El despliegue y la programación requieren el hosting, la base y los secretos anteriores. La integración de código puede revisarse y probarse antes de configurar cualquiera de ellos.

## Presupuesto gratuito de Tavily

Usar el plan Researcher gratuito sin activar pago por uso. La tienda usa únicamente
Search basic (un crédito), sin auto_parameters, respuestas generadas, Extract, Crawl
ni reintentos automáticos. Verifica hasta tres URLs candidatas con el scraper propio.
Cada intento reserva un cupo en PostgreSQL antes de salir a la API; un timeout también
consume ese cupo conservador. El contador sobrevive reinicios y varios procesos y
separa meses UTC. Las claves nunca se guardan en esa tabla ni se envían al cliente.

El panel muestra uso y límite local. Al agotarlo, se pausa la búsqueda y continúa
la revisión de enlaces principales y alternativas guardadas. Con una consulta por
producto cada cuatro horas, 5 productos consumen aproximadamente 900 al mes de
30 días; un mes más largo puede agotar antes el presupuesto. El límite no concede
créditos adicionales ni mide otras aplicaciones que usen la misma cuenta Tavily.
Crear una clave dedicada y mantener el plan gratuito para evitar cargos externos.
Sin clave aún no hay una búsqueda Tavily real verificada; pruebas usan fixtures.
