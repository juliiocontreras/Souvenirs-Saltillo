# Monitor cada cuatro horas con Cloudflare Workers

El Worker de `ops/cloudflare-monitor/` llama al backend de la tienda. La extracción,
las búsquedas Tavily, las cuotas, los leases y el historial continúan en Render y
Neon. No requiere una base adicional ni copia datos de clientes o proveedores.

## Preparación y costo

Confirmar **Workers Free** en la cuenta antes de activar esta alternativa. La
conexión OAuth de Cloudflare no permite consultar la facturación. No contratar
Workers Paid ni cambiar el plan de otros proyectos para habilitarla.

La configuración usa un cron y seis invocaciones diarias. Cada invocación limita
su trabajo a 24 solicitudes, dos reintentos consecutivos y 14 minutos. Los límites
Free documentados incluyen 10 ms de CPU por invocación, 50 subrequests y 15 minutos
de duración para cron. La espera de red no cuenta como CPU. La cuota es compartida
con otros Workers de la cuenta; comprobar también los cron existentes.

El Worker no extrae páginas ni ejecuta búsquedas: esas tareas pertenecen al backend.
Si se alcanza el límite de CPU, tiempo, solicitudes o cuota, revisar los registros;
no ampliar automáticamente el plan ni anunciar una revisión completa.

Fuentes oficiales consultadas el 24 de octubre de 2026:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Activación

1. Publicar el backend que devuelve contadores compactos a solicitudes con Bearer.
2. En Render configurar `MONITOR_WEB_MODE=full` y `MONITOR_BATCH_SIZE=1`.
   Conservar `MONITOR_SCHEDULER_CONFIGURED=false` hasta verificar la ejecución.
3. Publicar un Worker independiente llamado `souvenirs-saltillo-monitor`, usando
   `ops/cloudflare-monitor/wrangler.jsonc`. El cron viene vacío para el primer despliegue.
   No sustituir scripts existentes de otros proyectos.
4. Guardar `MONITOR_SECRET` como secreto del Worker, con el mismo valor privado
   que usa Render. `MONITOR_URL` debe ser la URL HTTPS exacta, sin redirecciones,
   de `/api/supplier/monitor`. No colocar secretos en Git, archivos públicos o logs.
5. Antes de habilitar el cron, detener el scheduler anterior y deshabilitar su
   reinicio en el boot hook. Mantener GitHub `MONITOR_ENABLED` desactivado.
6. Ejecutar una prueba autenticada `POST /run` sobre el Worker. Este endpoint usa
   la misma función que el evento cron. Confirmar `status=completed` y una nueva
   ejecución persistida en el panel; con catálogo vacío `checked=0` es correcto.
7. Habilitar el cron `17 */4 * * *` (UTC). En Saltillo: 02:17, 06:17, 10:17,
   14:17, 18:17 y 22:17. Verificar la configuración y marcar
   `MONITOR_SCHEDULER_CONFIGURED=true`. La propagación del cron puede tardar 15 min.
8. Revisar la primera ejecución realmente programada. Una prueba manual verifica
   el recorrido, pero no demuestra que el evento cron ya se haya disparado.

Render Free puede dormir: el primer lote admite reintentos acotados ante arranque
lento. Esto ejecuta trabajo cada cuatro horas, no envía tráfico para mantener la
web despierta. No garantiza una hora exacta ni atención inmediata las 24 horas.

## Comportamiento ante errores

El endpoint manual exige Bearer; otras rutas devuelven 404. No se siguen
redirecciones con el secreto. Los errores de autorización, respuestas inválidas o
demasiado grandes detienen el ciclo. Los fallos temporales y el lease ocupado
permiten hasta dos reintentos. Un lote sin progreso detiene el ciclo. Los enlaces
pendientes permanecen en Neon para la siguiente ejecución.

No se publican cambios, se sustituyen proveedores ni se inventan datos desde el
programador. Las observaciones se revisan en el panel y Tavily conserva su tope
local de 900 búsquedas por mes UTC.

## Desactivar o migrar

Vaciar únicamente la lista de schedules de este Worker y poner
`MONITOR_SCHEDULER_CONFIGURED=false` en Render. No borrar otros Workers, secretos
ni registros DNS. Conservar solo un programador activo al volver a GitHub Actions
o a otro hosting. No registrar esta alternativa como activa hasta completar los
pasos de verificación anteriores.
