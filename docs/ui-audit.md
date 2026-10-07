# Auditoría UI/UX — Souvenirs Saltillo

## Hallazgo de origen
El repositorio canónico se creó vacío; no contenía el storefront histórico. Por ello esta auditoría evalúa la nueva base implementada y evita afirmar que el sitio anterior fue migrado.

## Criterios aplicados
- Mobile first y jerarquía simple.
- Fondo claro, tarjetas blancas, bordes suaves y CTA de alto contraste.
- Administración visualmente separada del storefront.
- Login sin enlaces operativos sensibles.
- Importación de proveedor presentada como acción administrativa con revisión previa.
- Información interna de proveedor excluida del modelo público.

## Mejoras siguientes
1. Catálogo real conectado a persistencia.
2. Tabla de productos con estados de fuente: OK, cambió, roto, alternativa disponible.
3. Previsualización editable antes de publicar una importación.
4. Historial de precios y cambios de proveedor.
5. Pedidos con timeline de personalización/entrega.
6. Bot de atención con handoff humano.
7. Auditoría visual de navegador después del primer deploy.

## Regla UX
El agente recomienda; el administrador aprueba. Ningún cambio de proveedor, costo o precio público se publica silenciosamente.
