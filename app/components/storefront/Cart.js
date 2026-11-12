"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icons";
import { ProductImage } from "./Dialogs";
import {
  formatMxnCents,
  pesosToCents,
  MAX_QUANTITY,
} from "../../../packages/core/cart.mjs";

// El diálogo del carrito. Los precios que se muestran aquí son informativos:
// el total que se cobra se recalcula en el servidor contra el catálogo
// publicado antes de crear la sesión de Stripe.
function linePrice(product) {
  if (
    typeof product?.publicPrice !== "number" ||
    !Number.isFinite(product.publicPrice) ||
    product.publicPrice <= 0 ||
    product.currency !== "MXN"
  )
    return null;
  return pesosToCents(product.publicPrice);
}

export default function Cart({
  open,
  cart,
  products,
  onClose,
  onSetQuantity,
  onRemove,
}) {
  const ref = useRef(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setError("");
      ref.current?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [open ]);
  if (!open) return null;
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = cart.map((line) => ({ ...line, product: byId.get(line.id) }));
  const available = lines.filter((line) => linePrice(line.product) !== null);
  const subtotalCents = available.reduce(
    (total, line) => total + linePrice(line.product) * line.qty,
    0,
  );
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: available.map(({ id, qty }) => ({ id, qty })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo iniciar el pago.");
      // El carrito se conserva hasta que Stripe confirma el pago: la página
      // de éxito es la que lo vacía. Si el cliente cancela, sigue aquí.
      window.location.assign(result.url);
    } catch (failure) {
      setError(
        failure.message || "No se pudo iniciar el pago. Inténtalo de nuevo.",
      );
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="cart-title"
      className="sf-dialog sf-cart-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
    >
      <div className="sf-dialog-content">
        <button
          autoFocus
          type="button"
          className="sf-icon-button sf-dialog-close"
          aria-label="Cerrar carrito"
          onClick={() => ref.current.close()}
        >
          <Icon name="close" />
        </button>
        <p className="sf-eyebrow">Tu pedido</p>
        <h2 id="cart-title">Carrito</h2>
        {!lines.length && (
          <div className="sf-cart-empty">
            <Icon name="cart" size={52} />
            <p>Tu carrito está vacío.</p>
            <p className="sf-muted">
              Explora el catálogo y agrega los detalles que te gusten.
            </p>
            <button
              type="button"
              className="sf-button"
              onClick={() => ref.current.close()}
            >
              Ver el catálogo
            </button>
          </div>
        )}
        {lines.length > 0 && (
          <>
            <ul className="sf-cart-items">
              {lines.map((line) => {
                const price = linePrice(line.product);
                return (
                  <li className="sf-cart-item" key={line.id}>
                    <div className="sf-cart-thumb">
                      <ProductImage
                        src={line.product?.images?.[0]}
                        alt=""
                        width="72"
                        height="72"
                      />
                    </div>
                    <div className="sf-cart-copy">
                      <strong>
                        {line.product?.title || "Artículo no disponible"}
                      </strong>
                      {price === null ? (
                        <p className="sf-cart-unavailable">
                          Este artículo ya no está disponible para comprar.
                        </p>
                      ) : (
                        <p className="sf-cart-price">
                          {formatMxnCents(price)} c/u
                        </p>
                      )}
                      <div className="sf-cart-qty">
                        <button
                          type="button"
                          aria-label="Quitar una pieza"
                          disabled={line.qty <= 1}
                          onClick={() =>
                            onSetQuantity(line.id, line.qty - 1)
                          }
                        >
                          −
                        </button>
                        <span aria-label={`Cantidad: ${line.qty}`}>
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          aria-label="Agregar una pieza"
                          disabled={
                            price === null || line.qty >= MAX_QUANTITY
                          }
                          onClick={() =>
                            onSetQuantity(line.id, line.qty + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="sf-cart-line-total">
                      <strong>
                        {price === null
                          ? "—"
                          : formatMxnCents(price * line.qty)}
                      </strong>
                      <button
                        type="button"
                        className="sf-icon-button sf-cart-remove"
                        aria-label={"Quitar del carrito"}
                        onClick={() => onRemove(line.id)}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="sf-cart-summary">
              <p>
                <span>Subtotal</span>
                <strong>{formatMxnCents(subtotalCents)}</strong>
              </p>
              <p className="sf-muted">
                El envío se elige en el pago: recoger en Saltillo es gratis;
                el envío a todo México tiene costo fijo.
              </p>
              <p className="sf-muted">
                Los precios ya incluyen IVA. El total final lo confirma Stripe
                antes de cobrar.
              </p>
            </div>
            {error && (
              <p className="sf-cart-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="sf-button sf-cart-checkout"
              disabled={busy || !available.length}
              onClick={checkout}
            >
              {busy ? "Abriendo el pago seguro…" : "Pagar con tarjeta"}
            </button>
            <p className="sf-muted sf-cart-secure">
              Pago seguro con Stripe. No guardamos los datos de tu tarjeta.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
