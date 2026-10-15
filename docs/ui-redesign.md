# Rediseño de tienda — octubre de 2026

Referencias del propietario: The Gift Studio y Decoré. Se mantiene el catálogo
público real y el acceso al panel, con una dirección editorial de regalos.

## Sistema visual

- Fondo blanco cálido `#fefdfb`, secciones crema `#f7f5ef`, verde olivo `#464d35`,
  texto `#25271f` y separadores `#dfdfd5`.
- Títulos Cormorant Garamond 500; cursiva en portada. Navegación, formularios y
  texto DM Sans. Fuentes locales con licencias OFL incluidas.
- Contenedor máximo 1280 px; márgenes de 56/32/20 px según ancho.
- Botones rectangulares, radio 3 px, iconos de línea fina. Categorías circulares;
  catálogo abierto sin marcos ni tarjetas anidadas.
- Fotografías editoriales generadas y servidas localmente como WebP; no son
  fichas de productos ni implican disponibilidad. Las imágenes del catálogo
  proceden exclusivamente de productos publicados por el administrador.
- Orden: aviso, navegación, portada, beneficios, colecciones, catálogo real,
  personalización, marca y pie. Móvil con menú desplegable y fotografía bajo
  el texto para mantener legibilidad.

## Textos principales y navegación

Aviso: «Detalles que se convierten en recuerdos». Menú: Inicio, Catálogo,
Ocasiones, Personalizados, Nosotros; búsqueda y acceso a tienda.
Portada: «Hay detalles que lo dicen todo.»; descripción de regalos, detalles
personalizados y recuerdos; acciones «Explorar catálogo» y «Hazlo personal».
No se añaden descuentos, reseñas, envíos gratuitos ni checkout.

Las categorías se comparten entre menú, portada, colecciones, filtros y pie.
Los enlaces guardan categoría, búsqueda y orden en la URL y conservan el
comportamiento de abrir en otra pestaña y del historial. La búsqueda ignora
acentos. Ordenar por precio solo se ofrece para una moneda común, sin comparar
importes de monedas distintas. Las fichas abren un diálogo con imágenes, precio
público, moneda y plazo; no exponen costos ni enlaces internos de proveedores.

Catálogo vacío, búsqueda sin coincidencias y error de carga son estados distintos.
Preguntas frecuentes y fichas usan diálogos nativos con Escape, foco y cierre.
Los estilos de tienda están aislados del panel y del acceso administrativo.

## Evidencia de diseño

Dos conceptos coordinados: portada/colecciones y catálogo/personalización/pie.
12ui no pudo autenticar su servicio; se generaron los conceptos con Image Gen
y se implementa su sistema visual sobre Next.js. La conversión alojada de 12ui
no se utiliza. La comprobación final compara ambos conceptos con el navegador.

## Revisión visual y funcional

Se comparan los conceptos y las capturas con `view_image`, además de revisar
la interfaz en el navegador. Chromium/Playwright se utiliza para la versión local
porque el navegador integrado está conectado a otro entorno; la URL pública se
comprueba también con el navegador integrado tras desplegar.

| Elemento     | Referencia y decisión                                                         | Verificación                                                                                  |
| ------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Portada      | Franja olivo, cabecera blanca, fotografía a la derecha y texto a la izquierda | Se ajustaron la altura de portada y los controles para conservar la composición               |
| Tipografía   | Serif con cursiva en el título y sans serif en controles                      | Fuentes locales, tamaños de controles explícitos y títulos revisados en sus anchos reales     |
| Colores      | Blanco cálido, crema, verde olivo y separadores discretos                     | Tokens compartidos; sin filtros de color sobre las fotografías                                |
| Colecciones  | Tres fotografías circulares y enlaces de exploración                          | Se corrigieron diámetro y separación vertical; cada enlace aplica su categoría                |
| Catálogo     | Búsqueda, filtros y selección de orden sobre una superficie abierta           | Se probaron artículos de prueba solo en un proceso local; la tienda real mantiene su catálogo |
| Continuación | Banner de personalización, texto de marca y pie olivo                         | Se redujeron alturas sobrantes para respetar la densidad del concepto                         |
| Móvil        | Mismo orden y lenguaje visual con texto separado de la fotografía             | Anchos 320, 390, 768, 1024, 1272 y 1440 px, sin desbordamiento ni imágenes rotas              |

Comparación de textos sobre el primer pliegue: se conservaron aviso, marca,
navegación, título, descripción, botones y nota del concepto. No se añadieron
promociones ni textos de prueba. Se sustituyeron las escenas de las imágenes del
concepto por sus fotografías de producción coordinadas; las etiquetas físicas
de esas fotografías pueden variar. Los diálogos de producto y de preguntas
frecuentes amplían las acciones del catálogo y del pie dentro del mismo sistema.

Se verifican búsqueda con acentos y varias palabras, orden por precio y valores
desconocidos, filtros tras recargar, restauración con Atrás, menú de ocasiones,
cierre con Escape, retorno del foco y galería. Las 5 pruebas nuevas de dominio
complementan las pruebas existentes; el build de Next.js es de producción.
No se detectaron errores JavaScript en los recorridos revisados.
