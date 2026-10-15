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
export function ProductDialog({ product, onClose }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = product.images || [];
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
          Busca la categoría Personalizados. En la ficha de cada artículo verás
          si admite personalización. Las opciones dependen del producto.
        </p>
      </details>
      <details>
        <summary>¿Cuánto tarda la entrega?</summary>
        <p>
          Cada ficha indica un tiempo estimado cuando está disponible. La fecha
          final depende de la cantidad, la personalización y el destino, y se
          confirma para cada pedido.
        </p>
      </details>
      <details>
        <summary>¿Puedo encontrar regalos para mi empresa o evento?</summary>
        <p>
          Sí. Explora Empresas y eventos para ver los artículos publicados en
          esa colección. La disponibilidad se confirma según la cantidad que
          necesites.
        </p>
      </details>
      <details>
        <summary>¿Cómo consulto el precio de un artículo?</summary>
        <p>
          El precio publicado aparece en cada ficha junto con su moneda. Si dice
          “Precio por confirmar”, todavía no hay un precio disponible para ese
          artículo.
        </p>
      </details>
    </Dialog>
  );
}
