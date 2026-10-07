# Seguridad operativa

- El repositorio debe configurarse como privado antes de añadir operación real.
- Nunca guardar ADMIN_PASSWORD, AUTH_SECRET, MONITOR_SECRET, API keys o tokens en Git.
- El storefront consume únicamente la proyección pública del producto.
- supplier_cost, supplier_url, margen, historial y alternativas son exclusivos del administrador.
- El importador bloquea localhost, rangos IPv4 privados y protocolos distintos de HTTP(S).
- Los resultados extraídos de sitios externos son datos no confiables: se previsualizan y requieren aprobación.
- No evadir autenticación, CAPTCHA ni controles anti-bot de proveedores.
- El monitor no cambia automáticamente de proveedor.
