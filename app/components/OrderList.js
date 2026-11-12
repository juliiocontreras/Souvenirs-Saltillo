"use client";
import { useEffect, useState } from "react";
import { formatMxnCents } from "../../packages/core/cart.mjs";

// Etiquetas de estado del pedido (el mapa vive en packages/core/orders.mjs
// para el servidor; aquí se repite porque ese módulo usa node:crypto y no
// se puede importar en un componente cliente).
const ORDER_STATUS_LABELS = { paid: "Pagado" };

// Bandeja de pedidos pagados con Stripe. Sigue el patrón de QuoteInbox:
// carga desde /api/orders (solo admin) y muestra el estado, el total y el
// método de entrega de cada pedido. Los pedidos se registran solos cuando
// Stripe confirma el pago (webhook); aquí no se crean ni se editan.
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(new Date(value))
    : "Pendiente";

function deliveryLabel(order) {
  if (order.deliveryMethod === "shipping") return "Envío a todo México";
  if (order.deliveryMethod === "pickup") return "Recoger en Saltillo";
  return "Entrega por confirmar";
}

function shippingAddress(order) {
  const address = order.shipping?.address;
  if (!address) return null;
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function OrderList() {
  const [orders, setOrders] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    load();
  }, []);
  async function load() {
    setBusy("load");
    setError("");
    try {
      const response = await fetch("/api/orders");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setOrders(result.orders);
    } catch (failure) {
      setError(failure.message || "No pudimos cargar los pedidos.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section id="pedidos" className="order-list">
      <div className="section-heading">
        <div>
          <h2>Pedidos pagados</h2>
          <p className="muted">
            Ventas cobradas con Stripe. Últimos 200 pedidos, del más reciente
            al más antiguo.
          </p>
        </div>
        <button
          type="button"
          className="btn ghost"
          disabled={Boolean(busy)}
          onClick={load}
        >
          {busy === "load"
            ? "Cargando…"
            : orders === null
              ? "Ver pedidos"
              : "Actualizar pedidos"}
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {orders?.length === 0 && (
        <p className="card empty">
          Aún no hay pedidos pagados. Cuando un cliente complete el pago en
          Stripe, su pedido aparecerá aquí.
        </p>
      )}
      {orders?.map((order) => (
        <article className="card order" key={order.id}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Pedido · {date(order.createdAt)}
              </p>
              <h3>{formatMxnCents(order.totalCents)}</h3>
              <p className="muted">
                {order.customer?.name || "Cliente"} ·{" "}
                {order.customer?.email || "sin correo"} ·{" "}
                {deliveryLabel(order)}
              </p>
            </div>
            <span className="badge good">
              {ORDER_STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <dl className="product-facts">
            <div>
              <dt>Artículos</dt>
              <dd>
                {order.items
                  .map(
                    (item) =>
                      `${item.title} · ${item.quantity} ${item.quantity === 1 ? "pieza" : "piezas"}`,
                  )
                  .join(" — ")}
              </dd>
            </div>
            {order.shipping?.name && (
              <div>
                <dt>Destinatario</dt>
                <dd>{order.shipping.name}</dd>
              </div>
            )}
            {shippingAddress(order) && (
              <div>
                <dt>Dirección de envío</dt>
                <dd>{shippingAddress(order)}</dd>
              </div>
            )}
            <div>
              <dt>Pago</dt>
              <dd>
                Stripe · sesión {String(order.stripeSessionId).slice(-8)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}
