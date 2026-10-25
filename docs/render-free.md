# Render Free con la base existente de Neon

Alternativa preparada cuando Netlify bloquea publicaciones por cuota agotada.
La preparación del repositorio no significa que el servicio esté publicado.

## Condiciones para mantener el costo en cero

Confirmar el espacio con el propietario antes de crear el servicio. Usar un
espacio gratuito **sin método de pago registrado**. Render puede cobrar
excedentes de transferencia si existe un método de pago; sin él, suspende los
servicios gratuitos al agotar la cuota. No añadir tarjeta, cambiar el plan,
crear una base de Render, contratar discos ni crear cron de pago.

Render Free comparte 750 horas mensuales entre los servicios gratuitos del
espacio. Revisar los servicios existentes antes de crear este para no consumir
la cuota de otro proyecto. El servicio duerme tras 15 minutos sin tráfico;
el siguiente acceso puede tardar alrededor de un minuto en despertar. No ofrece
atención inmediata garantizada las 24 horas.

Fuentes oficiales revisadas el 19 de octubre de 2026:

- [Límites gratuitos y excedentes](https://render.com/docs/free).
- [Configuración de Blueprint](https://render.com/docs/blueprint-spec).
- [Dominios personalizados](https://render.com/docs/custom-domains).

## Publicar y revisar antes de cambiar DNS

1. Usar `render.yaml` o crear un único servicio web Node en plan **Free**,
   región Ohio, repositorio `juliiocontreras/Souvenirs-Saltillo`, rama `main`.
   Compilar con `bash ops/render-build.sh` e iniciar con
   `bash ops/render-start.sh`. No sustituir el servidor por un sitio estático:
   el acceso, las cotizaciones y el catálogo necesitan el backend.
2. Configurar las variables privadas indicadas en `render.yaml`. Reutilizar
   la conexión TLS verificada de la base Neon de la organización `sourvenirs`;
   **no volver a migrar ni sobrescribir sus datos**. Mantener las claves fuera
   del repositorio, los registros y el chat.
3. Al iniciar, `ops/render-start.sh` usa la URL HTTPS asignada por Render como
   origen autorizado, salvo que `APP_ORIGIN` se haya establecido expresamente.
   Configurar Node 22 y dejar que Render proporcione el puerto.
4. Verificar la URL temporal: imágenes, CSS, JavaScript, menú móvil, categorías
   vacías, asistente de cotización, login/logout y protección de APIs privadas.
   Una respuesta 200 de la portada por sí sola no verifica la publicación.
5. Añadir `suvenirssaltillo.shop` y `www.suvenirssaltillo.shop` al servicio en
   Render. Copiar **los destinos exactos que muestre ese servicio** al proveedor DNS
   autoritativo (Cloudflare en la instalación actual; GoDaddy sigue como registrador).
   El A de Netlify `75.2.60.5` no conecta un servicio de Render. Conservar NS,
   SOA, correo y verificaciones; revisar si existen AAAA incompatibles.
6. Confirmar DNS y certificado HTTPS. Entonces establecer
   `APP_ORIGIN=https://suvenirssaltillo.shop` y volver a comprobar el acceso y
   las escrituras desde el dominio. Revisar también `www` y su redirección.

## Monitor de proveedores

La alternativa preparada con Cloudflare Workers se describe en
[cloudflare-monitor.md](cloudflare-monitor.md). Su activación requiere verificar
una ejecución real y desactivar el programador anterior. No confundir un Worker
preparado en el repositorio con un cron desplegado.

El servicio gratuito duerme: no instalar un bucle dentro del servidor ni usar
peticiones para mantenerlo despierto. No crear un cron de Render de pago.
El workflow gratuito existente `Supplier monitor` puede trabajar directamente
con Neon, sin depender de que la web esté despierta.

Para activarlo hacen falta los secretos de GitHub Actions `MONITOR_DATABASE_URL`
y `SEARCH_API_KEY`, y las variables `MONITOR_TRANSPORT=database` y
`MONITOR_ENABLED=true`. Configurarlos requiere permisos de administración de
Actions; el token de integración actual no los tiene. Antes de habilitarlo,
desactivar el scheduler anterior para mantener una sola programación. Ejecutar
una revisión y comprobar el historial antes de marcar
`MONITOR_SCHEDULER_CONFIGURED=true`. No anunciar el monitoreo como activo solo
por tener el cron escrito en el repositorio.
