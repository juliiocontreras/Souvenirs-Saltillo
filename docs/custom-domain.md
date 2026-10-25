# Dominio del proyecto

Configuración comprobada el 24 de octubre de 2026:

- Dominio: `suvenirssaltillo.shop`.
- Registrador: GoDaddy. DNS autoritativo: Cloudflare (`cora.ns.cloudflare.com` y
  `evan.ns.cloudflare.com`). Los cambios DNS se hacen en Cloudflare.
- Hosting: Render Free, servicio `suvenirssaltillo`.
- Tienda: https://suvenirssaltillo.shop.
- Panel: https://suvenirssaltillo.shop/login.
- URL del servicio: https://suvenirssaltillo.onrender.com.

| Tipo | Nombre | Destino | Proxy |
| --- | --- | --- | --- |
| A | @ | 216.24.57.1 | Solo DNS |
| CNAME | www | suvenirssaltillo.onrender.com | Solo DNS |

El propietario añadió el dominio en Render y confirmó `Domain Verified`.
Se comprobaron HTTPS en ambos nombres, redirección de `www` al raíz, 14 recursos,
catálogo público, protección de APIs y acceso/cierre de sesión en el dominio raíz.
Los registros MX, SPF, DKIM y DMARC de correo se conservaron.

`APP_ORIGIN=https://suvenirssaltillo.shop` está aplicado en Render. Las cookies son
específicas del dominio: usar el panel del dominio raíz. Las escrituras desde otros
orígenes se rechazan. No desactivar esta comprobación para permitir el subdominio
provisional del hosting.

Para migraciones futuras, obtener los destinos exactos del nuevo servicio y
verificar su HTTPS antes de cambiar `APP_ORIGIN`. No restaurar el A de Netlify
`75.2.60.5`, ni cambiar los registros de correo al actualizar la web. Conservar
solo los registros compatibles con el proveedor de destino.
