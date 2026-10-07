# Modelo de producto

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
