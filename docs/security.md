# Seguridad operativa

- Código y ejemplos pueden compartirse; credenciales, catálogos privados, sesiones y datos de clientes quedan fuera de Git. Evaluar la visibilidad del repositorio según la operación del negocio.
- Nunca guardar ADMIN_PASSWORD, AUTH_SECRET, MONITOR_SECRET, API keys o tokens en Git.
- El storefront consume únicamente la proyección pública del producto.
- Cotizaciones y logos usan una tabla privada separada. Consultar solicitudes, cambiar su seguimiento y descargar adjuntos requiere sesión administrativa; nunca se incluyen en la API del catálogo.
- El envío de cotizaciones valida origen, autorización de contacto, tipos, límites, firma del archivo y una trampa antispam, con límite persistente de envíos. Los adjuntos se descargan con `nosniff` y sin caché; no se ejecutan en la página.
- supplier_cost, supplier_url, margen, historial y alternativas son exclusivos del administrador.
- El importador valida IPv4/IPv6, DNS, credenciales, puertos, límites y redirecciones. En salida directa fija la IP pública; con proxy requiere su control de egress privado. Conserva validación TLS.
- Los resultados extraídos de sitios externos son datos no confiables: se previsualizan y requieren aprobación.
- No evadir autenticación, CAPTCHA ni controles anti-bot de proveedores.
- El monitor no cambia automáticamente de proveedor.
- Autenticación falla cerrada si faltan contraseña de al menos 12 caracteres y secreto independiente de al menos 32. No existe un token conocido de respaldo.
- Sesiones firmadas, aleatorias, persistentes y con expiración de ocho horas; logout elimina el registro y la rotación de credenciales invalida sesiones previas.
- Escrituras de navegador verifican `Origin`; login tiene límite persistente de intentos. El worker usa un secreto independiente y no acepta `Bearer undefined`.
- Datos públicos se proyectan con allowlist y excluyen borradores. Las APIs privadas requieren sesión incluso cuando el navegador oculta sus controles.
- PostgreSQL es la persistencia de hosting serverless; un archivo se usa únicamente con un volumen durable explícito. No desactivar SSL para solucionar conexión a la base.
