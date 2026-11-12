import Link from "next/link";
import { orderRepository } from "../../../lib/order-store.mjs";
import { formatMxnCents } from "../../../packages/core/orders.mjs";
import { whatsappContactUrl } from "../../../packages/core/contact.mjs";
import { contactSettings } from "../../../lib/contact-settings.mjs";
import ClearCart from "../../components/storefront/ClearCart";
import "../../storefront-fonts.css";
import "../../storefront.css";
export const dynamic = "force-dynamic";
export default async function CheckoutSuccess({ searchParams }) {
  const params = await searchParams,
    sessionId =
      typeof params?.session_id === "string" ? params.session_id : "";
  let order = null;
  if (sessionId) {
    try {
      order = await orderRepository.getOrderBySession(sessionId);
    } catch {
      // El webhook puede tardar unos segundos; la página no depende de él.
    }
  }
  let whatsappNumber = "";
  try {
    ({ whatsappNumber } = await contactSettings());
  } catch {
    // El enlace de WhatsApp es opcional en esta página.
  }
  const whatsappUrl = whatsappContactUrl(whatsappNumber, {
    category: "Todos",
  });
  return (
    <div className="storefront">
      <ClearCart />
      <main
        className="sf-container sf-checkout-result"
        id="contenido"
        tabIndex={-1}
      >
        <p className="sf-eyebrow">Souvenirs Saltillo</p>
        <h1>¡Gracias por tu compra!</h1>
        <p>
          Tu pago se confirmó. Te contactaremos para coordinar la entrega de
          tu pedido.
        </p>
        {order && (
          <section className="sf-order-summary" aria-label="Resumen del pedido">
            <h2>Resumen del pedido</h2>
            <ul>
              {order.items.map((item) => (
                <li key={item.id + item.title}>
                  {item.title} · {item.quantity}{" "}
                  {item.quantity === 1 ? "pieza" : "piezas"} —{" "}
                  {formatMxnCents(item.lineTotalCents)}
                </li>
              ))}
            </ul>
            <p>
              <strong>Total pagado: {formatMxnCents(order.totalCents)}</strong>
            </p>
            <p className="sf-muted">
              {order.deliveryMethod === "shipping"
                ? "Envío a domicilio a todo México."
                : "Recoger en Saltillo."}
            </p>
          </section>
        )}
        {!order && sessionId && (
          <p className="sf-muted">
            Estamos registrando tu pedido; en unos segundos aparecerá en
            nuestro panel y te contactaremos con los detalles.
          </p>
        )}
        <div className="sf-checkout-actions">
          <Link className="sf-button" href="/#catalogo">
            Seguir explorando
          </Link>
          {whatsappUrl && (
            <a
              className="sf-button sf-button-outline"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribirnos por WhatsApp
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
