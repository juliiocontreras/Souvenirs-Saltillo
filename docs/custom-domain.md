# Dominio del proyecto

- Dominio proporcionado por el propietario: `suvenirssaltillo.shop`.
- Registrador indicado: GoDaddy.
- El propietario confirmó el nombre exacto y que GoDaddy lo muestra activo.
- Origen previsto: `https://suvenirssaltillo.shop`.
- Panel previsto: `https://suvenirssaltillo.shop/login`.
- Dirección actual verificada del hosting: `https://r1q3g0ao.basicdeploy.com`.

El 17 de octubre de 2026, los resolutores públicos de Google y Cloudflare
devolvieron NXDOMAIN para el dominio proporcionado. Esto indica que no está
resolviendo públicamente; no prueba por sí solo el estado de la compra.
El nombre exacto y el estado activo fueron confirmados por el propietario.

## Conexión en GoDaddy y el hosting

1. En GoDaddy, abrir **Mis productos → Dominios → suvenirssaltillo.shop → DNS**.
   Confirmar que el dominio esté activo y revisar qué servidores de nombres
   administran la zona. Si la zona está delegada a otro proveedor, editar allí.
2. Obtener del hosting la configuración para vincular este dominio al contenedor
   existente, incluyendo los registros de verificación y destino, y la emisión
   de su certificado HTTPS. Usar los valores que proporcione ese hosting.
3. Guardar en la zona DNS únicamente los registros necesarios. Para el nombre
   raíz se usa `@`; para `www` se configura un alias si también se va a vincular
   ese hostname. Conservar los registros de correo y de verificación existentes.
4. Verificar que el dominio resuelva y abra esta misma tienda por HTTPS con un
   certificado válido. Confirmar también el hostname `www` si se habilitó.
5. Entonces actualizar el archivo privado del servidor, conservando sus demás
   variables, y reiniciar únicamente esta aplicación:

   ```dotenv
   APP_ORIGIN=https://suvenirssaltillo.shop
   ```

6. Desde el dominio definitivo, comprobar inicio y cierre de sesión, guardado
   del contacto de WhatsApp, envío de cotización y consulta del panel. Las
   cookies son específicas de cada dominio: iniciar sesión de nuevo en el nuevo
   dominio. Las escrituras desde orígenes diferentes deben seguir rechazándose.

`APP_ORIGIN` controla la protección de origen de las escrituras del panel y de
las cotizaciones. Mantener su valor actual hasta verificar DNS y HTTPS evita
interrumpir el acceso existente durante la conexión. No se ha cambiado esta
variable en producción ni se han registrado cambios DNS desde esta sesión.

## Estado pendiente

Faltan obtener la vinculación del dominio en el hosting, aplicar sus registros
DNS y verificar HTTPS antes de actualizar el origen. No se han aplicado cambios
a la zona DNS ni a la configuración privada del servidor.
