# Souvenirs Saltillo

Tienda web/PWA para venta y personalización de souvenirs en Saltillo.

## Alcance
- Catálogo, carrito y flujo de solicitud/compra.
- Productos personalizables con recepción de logos e indicaciones.
- Panel administrativo protegido.
- Gestión de productos, categorías, precios y tiempos de entrega.
- Datos internos de proveedor nunca visibles al público.
- Importación asistida desde URL de proveedor.
- Costo de proveedor, margen configurable y precio sugerido.
- Monitoreo periódico de URLs de proveedor y detección de enlaces rotos/cambios.
- Proveedores alternativos sujetos a aprobación del administrador.
- Bot de atención para producto, fecha requerida, dirección y facturación.
- Trazabilidad de pedidos y personalización.

## Arquitectura prevista
- `apps/storefront`: tienda pública / PWA.
- `apps/admin`: panel administrativo.
- `services/supplier-agent`: importación y monitoreo de proveedores.
- `packages/core`: tipos, reglas de precios y lógica compartida.
- `docs`: arquitectura, modelo de datos y decisiones.

## Seguridad
Este repositorio no debe contener contraseñas, tokens, claves API ni URLs privadas con credenciales. Usar variables de entorno.

## Estado
Repositorio canónico creado para evitar que Souvenirs Saltillo se mezcle con otros proyectos. La siguiente fase es migrar/implementar la tienda y automatización sobre esta base.
