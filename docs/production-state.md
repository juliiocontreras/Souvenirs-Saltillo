# Estado del primer despliegue — 13 de octubre de 2026

- Tienda: https://r1q3g0ao.basicdeploy.com
- Panel: https://r1q3g0ao.basicdeploy.com/login
- Hosting: BasicDeploy, contenedor `r1q3g0ao`, plan gratuito de 256 MB.
- Base: PostgreSQL del hosting; catálogo, sesiones e historial persistentes.
- Acceso: contraseña aleatoria entregada por archivo privado al propietario; no hay
  contraseña predeterminada, cuenta de demostración ni credenciales en este repositorio.
- Monitor: scheduler del hosting instalado. Primera ejecución completada y estado
  conservado tras reiniciar; no había enlaces de productos guardados para revisar.
- Horarios de Saltillo: 02:17, 06:17, 10:17, 14:17, 18:17 y 22:17.
- GitHub `Supplier monitor`: desactivado para evitar dos schedulers. La conexión de
  GitHub no permite escribir secrets de Actions; el worker usa el secreto privado
  del hosting y registra resultados en la misma base.
- Búsqueda automática: **Tavily activado el 14 de octubre de 2026**. Plan gratuito
  y clave verificados; búsqueda real con tres resultados y contador persistente
  comprobado en el panel (1 de 900 consultas al realizar la prueba).

Verificación sobre HTTPS real: login, cookie Secure/HttpOnly/SameSite, APIs privadas,
rechazo de URL privada, importación de ficha sintética sin publicarla, catálogo
público vacío, autorización del monitor, origen externo rechazado, logout y replay,
vista móvil a 390 px sin desbordamiento. Sin errores JavaScript tras adaptar la
transformación HTML del hosting. El aviso del proveedor queda visible en el pie.

No se han importado productos comerciales ni se verificó un proveedor real del
negocio. Algunas fuentes requerirán un adaptador o API. No hay checkout ni pedidos.

## Configurar o rotar Tavily

La cuenta ya está conectada. Estos pasos se conservan para rotar la clave o para
configurar otra instalación; el rediseño de tienda conserva la configuración privada.

1. Crear cuenta y generar una clave en https://www.tavily.com/pricing.
2. Abrir BasicDeploy, contenedor `r1q3g0ao`, terminal.
3. Ejecutar `python3 /workspace/saltillo/current/ops/configure-search.py`.
4. Introducir la clave en el prompt privado. El script verifica el plan gratuito y la clave,
   guarda la clave con permisos 600 y reinicia únicamente esta aplicación.
5. Abrir el panel, comprobar que desaparece el aviso de búsqueda pendiente y
   ejecutar **Revisar proveedores** después de guardar productos reales.

El plan de Tavily y sus cuotas se eligen en la cuenta del propietario. No se ha
contratado ningún servicio o complemento de pago. El contenedor gratuito puede
suspenderse; el hook reinicia la tienda y recupera la revisión pendiente al despertar.
Una ejecución estricta sin tráfico exige un hosting sin suspensión.

## Operación

Los releases están separados de `/workspace/saltillo-private.env` y del estado del
monitor. `/workspace/.bd_boot.sh` inicia la versión señalada por
`/workspace/saltillo/current`. El archivo privado no forma parte de los paquetes.
Rotar `ADMIN_PASSWORD` o `AUTH_SECRET` invalida sesiones anteriores.

CI verifica código y PostgreSQL. **Package production** publica un paquete standalone
del mismo commit verificado; no actualiza el contenedor automáticamente. Instalar
cada versión comprobando su checksum y conservar la anterior para revertir.
Ver [deployment.md](deployment.md) para configuración, límites y recuperación.

Tavily opera con un tope de 900 consultas locales por mes UTC. El panel muestra
el contador; se pausa búsqueda al agotarlo y continúa el monitor. La clave del
propietario se transfirió cifrada y se guardó únicamente en el archivo privado
del hosting, con permisos 600. No forma parte de los releases ni del repositorio.
