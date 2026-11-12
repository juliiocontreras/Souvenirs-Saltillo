"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icons";
import { classificationLabel } from "../../../packages/core/categories.mjs";
import {
  deliveryLabel,
  publicPriceLabel,
} from "../../../packages/core/storefront.mjs";
export function ProductImage({ src, alt, ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      {...props}
    />
  ) : (
    <span className="sf-image-fallback">
      <Icon name="gift" size={44} />
      <span>Imagen no disponible</span>
    </span>
  );
}
function Dialog({ titleId, onClose, className = "", children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={"sf-dialog " + className}
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
          aria-label="Cerrar ventana"
          onClick={() => ref.current.close()}
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </dialog>
  );
}
export function ProductDialog({ product, onClose, onQuote, onAddToCart }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const images = product.images || [];
  const purchasable =
    typeof product.publicPrice === "number" &&
    Number.isFinite(product.publicPrice) &&
    product.publicPrice > 0 &&
    product.currency === "MXN";
  return (
    <Dialog
      titleId="product-dialog-title"
      onClose={onClose}
      className="sf-product-dialog"
    >
      <div className="sf-product-detail">
        <div>
          <div className="sf-detail-image">
            <ProductImage
              src={images[imageIndex]}
              alt={product.title}
              width="560"
              height="560"
            />
          </div>
          {images.length > 1 && (
            <div
              className="sf-image-thumbnails"
              aria-label="Imágenes del producto"
            >
              {images.map((src, index) => (
                <button
                  type="button"
                  key={src + index}
                  className={index === imageIndex ? "is-selected" : ""}
                  aria-label={"Ver imagen " + (index + 1)}
                  aria-pressed={index === imageIndex}
                  onClick={() => setImageIndex(index)}
                >
                  <ProductImage src={src} alt="" width="60" height="60" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="sf-detail-copy">
          <p className="sf-eyebrow">{classificationLabel(product)}</p>
          <h2 id="product-dialog-title">{product.title}</h2>
          <p className="sf-detail-price">{publicPriceLabel(product)}</p>
          {product.personalizationSupported && (
            <p className="sf-personalizable">
              <Icon name="pencil" size={17} />
              Este detalle se puede personalizar
            </p>
          )}
          <p className="sf-detail-description">
            {product.description ||
              "Pronto compartiremos más detalles de este artículo."}
          </p>
          <div className="sf-delivery-note">
            <Icon name="gift" size={25} />
            <div>
              <strong>{deliveryLabel(product)}</strong>
              <p>
                Disponibilidad y entrega se confirman según cantidad,
                personalización y destino.
              </p>
            </div>
          </div>
          <div className="sf-detail-quote">
            {purchasable && (
              <div className="sf-detail-buy">
                <div className="sf-cart-qty" aria-label="Cantidad">
                  <button
                    type="button"
                    aria-label="Quitar una pieza"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    −
                  </button>
                  <span aria-label={`Cantidad: ${quantity}`}>{quantity}</span>
                  <button
                    type="button"
                    aria-label="Agregar una pieza"
                    disabled={quantity >= 99}
                    onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="sf-button"
                  onClick={() => onAddToCart?.(quantity)}
                >
                  Agregar al carrito
                </button>
              </div>
            )}
            <button type="button" className="sf-button sf-button-outline" onClick={onQuote}>
              Cotizar este artículo <Icon name="arrow" size={18} />
            </button>
            <p>Cuéntanos la cantidad, el diseño y la fecha que necesitas.</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
export function FaqDialog({ onClose }) {
  return (
    <Dialog
      titleId="faq-dialog-title"
      onClose={onClose}
      className="sf-faq-dialog"
    >
      <p className="sf-eyebrow">Tu visita</p>
      <h2 id="faq-dialog-title">Cada detalle, más claro.</h2>
      <details open>
        <summary>¿Qué detalles puedo personalizar?</summary>
        <p>
          Explora la categoría Personalizados para ver las opciones para
          hacerlo único. Cuando pidas tu cotización, cuéntanos el artículo, la
          cantidad y el diseño que tienes en mente: ahí te confirmamos si
          admite personalización y cuáles son las opciones.
        </p>
      </details>
      <details>
        <summary>¿Cuánto tarda la entrega?</summary>
        <p>
          Depende de la cantidad, la personalización y el destino. La fecha
          final se confirma en tu cotización para cada pedido.
        </p>
      </details>
      <details>
        <summary>¿Puedo encontrar regalos para mi empresa o evento?</summary>
        <p>
          Sí. Cuéntanos en tu cotización cuántas piezas necesitas y para qué
          ocasión: te preparamos opciones coordinadas para tu equipo o evento.
        </p>
      </details>
      <details>
        <summary>¿Cómo consulto el precio de un artículo?</summary>
        <p>
          El precio de cada detalle se confirma en tu cotización, según el
          artículo, la cantidad y la personalización que elijas.
        </p>
      </details>
    </Dialog>
  );
}
