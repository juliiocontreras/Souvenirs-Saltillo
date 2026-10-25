# Categorías, personalización y cotizaciones

## Recuperar importaciones

El panel incluye **Importaciones pendientes**, con las fichas extraídas que aún
no se han aplicado al catálogo. Se conservan en la base al cerrar o recargar el
panel (hasta 100 importaciones recientes). **Continuar revisión** recupera la
consulta original sin volver a visitar el proveedor; la fecha permanece visible
para confirmar de nuevo las condiciones antes de publicar.

La bandeja señala imagen, costo, moneda y entrega pendientes. Los valores no
publicados por el proveedor no se inventan. Las modificaciones del formulario
no se guardan automáticamente: usar **Guardar borrador** para conservarlas como
producto privado. Cerrar la vista previa conserva la consulta original. Abrir
otra ficha con una vista previa abierta solicita confirmar el cambio.

Las rutas de listado y lectura de importaciones exigen sesión administrativa,
no permiten caché y no exponen borradores en el catálogo público. Las importaciones
ya aplicadas desaparecen de la bandeja y no se reabren como consultas pendientes.

La taxonomía compartida entre servidor, panel, filtros y asistente está en
`packages/core/categories.mjs`:

| Categoría        | Subcategorías                                |
| ---------------- | -------------------------------------------- |
| Oficina          | Plumas, Agendas, Libretas                    |
| Equipaje         | Mochilas, Bolsas, Maletas, Maletines, Fundas |
| Electrónica      | Cables, USB, Cargadores, Relojes, Linternas  |
| Deportes         | Sin subcategorías por ahora                  |
| Cuidado personal | Sin subcategorías por ahora                  |
| Llaveros         | Sin subcategorías por ahora                  |

La selección se ofrece al importar una ficha y en **Editar categoría**, dentro
del catálogo del panel. Esta acción cambia solamente clasificación y fecha de
actualización. El servidor rechaza combinaciones incompatibles. La clasificación
se conserva al revisar o cambiar de proveedor. Las clasificaciones anteriores
siguen siendo válidas para conservar los productos y enlaces existentes.
“Personalizados” también reúne productos marcados como personalizables,
independientemente de su categoría principal.

Los filtros públicos incluyen `categoria`, `subcategoria`, `q` y `orden` en la
URL. Al cambiar de categoría se limpia la subcategoría anterior. Los filtros de
categoría se envuelven en varias líneas para seguir visibles en pantallas pequeñas.

## Asistente de cotización

Se abre desde **Cotizar**, **Cotiza tu idea** y **Cotizar mi diseño**. Se admiten
los enlaces `/#cotizar` y `/#personaliza`. Es una atención automática guiada:

**Solicitar información** y **Cotizar** llevan la categoría y subcategoría
seleccionadas al pedido. En cada ficha, **Cotizar este artículo** también añade
el título público a las características; no copia datos privados del proveedor.
El primer paso sigue siendo el contacto del cliente.

Si existe una solicitud sin enviar, una selección diferente se propone antes de
cambiar el pedido. **Usar esta selección** conserva contacto, cantidad, fecha,
logo y características previas; el nuevo artículo se incorpora sin duplicarlo y
la autorización de contacto debe marcarse de nuevo. **Continuar mi solicitud**
conserva el borrador anterior. Si el texto combinado supera el límite, se informa
al cliente sin recortar sus requisitos. Cerrar y volver a abrir conserva el
borrador en memoria; recargar la página lo descarta.

1. Contacto: nombre, empresa opcional, medio preferido y teléfono o correo.
2. Pedido: categoría, tipo, cantidad, características y presupuesto opcional.
3. Diseño y entrega: logo disponible, ayuda con diseño o sin logo; archivo opcional;
   fecha deseada o por definir, ciudad/estado, urgencia y factura.
4. Revisión y autorización para usar los datos con el fin de atender la solicitud.

Los datos permanecen en memoria del navegador hasta el envío autorizado; no se
guardan en almacenamiento local del navegador. El cliente recibe un folio solo
cuando el servidor confirma el guardado. Reintentar el mismo envío conserva el
folio sin duplicar la solicitud. Tras el envío se muestran hasta tres artículos
publicados que coincidan. Si no hay coincidencias, se muestran líneas de cotización
de la taxonomía y se informa que el equipo confirmará opciones y condiciones.

**Cotizaciones**, en el panel, muestra las últimas 200 solicitudes. Permite
consultar los requisitos, descargar el logo, abrir el contacto y registrar
Nueva, En seguimiento, Cotizada o Cerrada. El seguimiento humano se realiza por
el medio elegido por el cliente. El asistente no envía correos o mensajes externos
por cuenta del administrador.

## Persistencia y acceso

PostgreSQL usa la tabla separada `souvenirs_quote_requests` con `id uuid`, `data
jsonb` y `logo_data bytea`. Se crea al utilizarla por primera vez. La consulta del
catálogo no lee datos de clientes ni adjuntos. Para desarrollo, las solicitudes
se guardan en un archivo privado separado junto a `CATALOG_DATA_FILE`.
Incluir esta tabla en los respaldos y en cualquier proceso de retención o
eliminación de datos de clientes.

`POST /api/quotes` es público y exige el origen de la tienda, validación de
campos, autorización de contacto, límite de cuerpo y una trampa antispam. Se
limita a diez envíos por origen de red en quince minutos. El identificador de
red se conserva como un HMAC, no como dirección IP sin procesar. El recibo no
devuelve los datos del cliente. `GET /api/quotes`, `PATCH /api/quotes/[id]` y
`GET /api/quotes/[id]/logo` requieren sesión administrativa. Las escrituras
administrativas también validan el origen.

Los logos admiten PNG, JPG, WebP o PDF hasta 1 MB. El servidor valida su firma y
los entrega como descarga privada, con `nosniff` y sin caché. No se publican como
imágenes del catálogo ni se ejecutan en la página.

El asistente no requiere una nueva clave de IA ni consume consultas de Tavily.
Funciona a cualquier hora mientras la tienda está disponible. El plan gratuito
actual puede suspender el contenedor; una garantía estricta de disponibilidad
continua requiere un hosting que no se suspenda.

## Referencia anterior

Se intentó abrir el sitio proporcionado por el propietario. Mostró “Log in to
access” de ChatGPT, por lo que no se pudo auditar su contenido interno. El
propietario confirmó personalización y cotización como las funciones a incorporar.
No se atribuyen funciones adicionales a esa referencia sin haberlas observado.

## Ampliación del submenú de souvenirs

El submenú **Catálogo** incorpora también Tazas y termos, Textiles y gorras,
Hogar y cocina, Ecológicos, Herramientas y automotriz, Paraguas e impermeables,
Infantiles y juegos, Hieleras y loncheras, Bar y vinos, Mascotas, Sets de regalo
y Souvenirs de Saltillo. Todas las familias están disponibles en el panel y
el asistente para clasificar o solicitar artículos, aunque todavía estén vacías.

Se contrastaron categorías con la navegación pública de:

- [PromoOpción México](https://www.promoopcion.com/): termos, cilindros, gorras,
  herramientas, hieleras y recomendaciones ecológicas.
- [Caravian](https://caravian.com.mx/catalogos/): hogar, automotriz, textiles,
  paraguas, sets y accesorios promocionales.
- [Arte Promocional y Textil](https://artepromocionalmx.com/): bar y vinos,
  infantiles, mascotas, impermeables y otras familias de regalos.

La familia de Saltillo agrupa imanes, postales, artesanías y recuerdos regionales
como línea de cotización. La presencia de una categoría no anuncia existencias.

Al seleccionar una categoría o subcategoría vacía se muestra **“Estamos trabajando
para brindarte estas opciones de souvenir”**, con invitación de contacto por
WhatsApp. Una búsqueda sin coincidencias dentro de una categoría con artículos
conserva su estado de búsqueda; un error del servidor conserva su aviso de error.
En móvil y tableta se usa un selector compacto de categoría para que el listado
ampliado no desplace el contenido varias pantallas.

## Configurar WhatsApp desde el panel

En **Panel → Configuración → WhatsApp del negocio**, guardar el número público
con código de país. Para México: `+52` seguido de los diez dígitos. **Probar
WhatsApp guardado** permite verificar la cuenta de destino. El cambio aparece al
abrir o recargar la tienda; no requiere reiniciar ni volver a publicar el servidor.
El mensaje del enlace `wa.me` incluye la categoría y el tipo de artículo elegido.

El dato persiste en `souvenirs_catalog_records`, namespace `settings`, clave
`publicContact`. Para instalaciones existentes, `WHATSAPP_NUMBER` continúa como
valor inicial mientras no se haya guardado una configuración. Guardar el campo
vacío desactiva el enlace incluso si existe ese valor en el servidor. Un teléfono
ausente o inválido conserva el asistente de solicitud como alternativa.

`GET /api/settings/contact` y `PATCH /api/settings/contact` requieren sesión
administrativa; la escritura también exige el origen de la tienda. Solo se acepta
`whatsappNumber`, normalizado a 8–15 dígitos. No se modifican claves privadas,
productos ni solicitudes de clientes. Esta validación comprueba el formato; el
administrador debe verificar que el número corresponde a su cuenta de WhatsApp.
