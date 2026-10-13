# Supplier Agent integrado

## Importación
1. El administrador pega una URL de proveedor.
2. El bot extrae JSON-LD/metadatos: título, descripción, imágenes, costo, moneda y entrega publicada; los campos ausentes permanecen pendientes. No usa un LLM ni renderiza páginas dinámicas del proveedor.
3. Normaliza la información.
4. Calcula sugerido con margen bruto, costo unitario, flete, comisiones, impuesto y redondeo; no convierte divisas.
5. Presenta una vista previa editable y selección explícita de ficha/variante. Al reimportar conserva ajustes del administrador y política de precio en la vista previa.
6. El administrador aprueba antes de publicar.

## Monitoreo
Worker real con persistencia, lease/heartbeat y lotes. Programación preparada cada cuatro horas mediante GitHub Actions; activar después del primer despliegue según [deployment.md](deployment.md).

Por cada producto:
- verificar disponibilidad de la URL;
- detectar cambios de costo;
- detectar cambios de entrega;
- distinguir enlaces retirados, bloqueados, limitados y errores temporales o de extracción;
- registrar `lastCheckedAt`, `nextCheckAt`, precio observado y evidencia de estado sin modificar los datos públicos aprobados;
- revisar alternativas guardadas y buscar nuevos candidatos durante cada ciclo del enlace principal con Brave Search, cuando esté configurado.

No cambiar automáticamente de proveedor ni publicar un nuevo precio sin una regla explícita o aprobación administrativa.

## Reutilización
La [skill](../skills/supplier-catalog-agent/SKILL.md) y su contrato de adaptación están listos para otros proyectos. El runtime está en `packages/core` y `lib`; el proyecto receptor debe adaptar sus permisos, persistencia, imágenes y hosting. Copiar la skill no configura un scheduler automáticamente.
