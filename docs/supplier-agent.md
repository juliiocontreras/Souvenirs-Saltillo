# Supplier Agent

## Importación
1. El administrador pega una URL de proveedor.
2. El agente obtiene título, descripción, imágenes, costo y tiempo estimado de entrega.
3. Normaliza la información.
4. Calcula un precio sugerido usando la configuración de margen vigente.
5. Presenta una vista previa.
6. El administrador aprueba antes de publicar.

## Monitoreo
Frecuencia objetivo: cada 4 horas.

Por cada producto:
- verificar disponibilidad de la URL;
- detectar cambios de costo;
- detectar cambios de entrega;
- marcar enlaces rotos;
- actualizar `source_last_checked_at`;
- buscar candidatos alternativos por título/SKU/atributos cuando sea necesario.

No cambiar automáticamente de proveedor ni publicar un nuevo precio sin una regla explícita o aprobación administrativa.

## Reutilización
La lógica se mantendrá desacoplada del storefront para poder empaquetarla posteriormente como Skill reutilizable en NFC México, RIBBON u otras tiendas.
