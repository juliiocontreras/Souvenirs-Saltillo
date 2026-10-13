# Modelo de producto

El modelo siguiente es conceptual. El runtime utiliza JSON con `camelCase` y la tabla `souvenirs_catalog_records`; no hay conversión automática desde tablas históricas. Ver [database-schema.sql](database-schema.sql).

Campos operativos del runtime: `id`, `slug`, `title`, `description`, `category`, `publicPrice`, `supplierCost`, `currency`, `images`, `deliveryDays`, `deliveryMinDays`, `personalizationSupported`, `stockStatus`, `status` (`draft`/`published`), `supplierUrl`, `sourceKey`, `sourceIdentity`, `sourceOriginal`, `pricing`, `suggestedPrice`, `manualPublicPrice`, `overrides`, `evidence`, `conditionsConfirmed`, `sourceStatus`, `sourceObservation`, `lastCheckedAt`, `nextCheckAt`, `createdAt` y `updatedAt`.

La API pública proyecta solo identidad pública, categoría, descripción, precio, moneda, imágenes, entrega, personalización y disponibilidad. Costos, URLs de producto del proveedor, política de precio, originales, evidencia, borradores e historial quedan fuera de esa respuesta.

Campos mínimos:

- id
- slug
- title
- description
- category
- subcategory
- public_price
- supplier_cost
- margin_amount
- margin_percent
- suggested_price
- supplier_name
- supplier_url (solo admin)
- alternate_supplier_url (solo admin)
- delivery_days
- delivery_text
- images
- personalization_supported
- personalization_notes
- stock_status
- source_status
- source_last_checked_at
- source_price_changed
- created_at
- updated_at

## Regla
`supplier_cost`, URLs de proveedor, márgenes y resultados de monitoreo son datos privados y nunca deben enviarse al storefront público.
