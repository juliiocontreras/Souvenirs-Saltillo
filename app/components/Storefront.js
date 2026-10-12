"use client";
import { useState } from "react";
export default function Storefront({ products, unavailable }) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todos");
  const categories = [
    "Todos",
    "Regalos",
    "Personalizados",
    "Empresas y eventos",
  ];
  const filtered = products.filter(
    (product) =>
      (category === "Todos" ||
        product.category === category ||
        (category === "Personalizados" && product.personalizationSupported)) &&
      (product.title + " " + product.description)
        .toLocaleLowerCase("es-MX")
        .includes(query.toLocaleLowerCase("es-MX")),
  );
  return (
    <section
      id="catalogo"
      className="catalog-section"
      aria-labelledby="catalog-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Encuentra tu detalle</p>
          <h2 id="catalog-title">El catálogo</h2>
        </div>
        <label className="search-label">
          <span className="sr-only">Buscar productos</span>
          <input
            type="search"
            placeholder="Buscar un artículo…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar productos"
          />
        </label>
      </div>
      <div className="category-tabs" role="group" aria-label="Categorías">
        {categories.map((name) => (
          <button
            key={name}
            className={"btn " + (category === name ? "" : "ghost")}
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="muted small" role="status" aria-live="polite">
        {products.length
          ? `${filtered.length} ${filtered.length === 1 ? "artículo" : "artículos"}`
          : ""}
      </p>
      {!filtered.length && (
        <div className="card empty">
          <p className="eyebrow">
            {products.length ? "Sigue explorando" : "Próximamente"}
          </p>
          <h3>
            {products.length
              ? "No encontramos ese artículo"
              : "Estamos preparando nuevos detalles"}
          </h3>
          <p className="muted">
            {products.length
              ? "Prueba otro nombre o cambia de categoría."
              : unavailable
                ? "El catálogo estará disponible próximamente."
                : "Los productos aparecerán aquí cuando estén listos para compartir."}
          </p>
          {products.length > 0 && (
            <button
              className="btn ghost"
              onClick={() => {
                setQuery("");
                setCategory("Todos");
              }}
            >
              Ver todos los artículos
            </button>
          )}
        </div>
      )}
      <div className="grid product-grid">
        {filtered.map((product) => (
          <article className="card store-product" key={product.id}>
            <div className="product-image">
              {product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="muted">Imagen pendiente</span>
              )}
            </div>
            <div className="product-copy">
              <div className="actions product-tags">
                <span className="muted small">{product.category}</span>
                {product.personalizationSupported && (
                  <span className="badge good">Personalizable</span>
                )}
              </div>
              <h3>{product.title}</h3>
              <p className="public-price">
                {product.publicPrice !== null && product.currency
                  ? new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: product.currency,
                    }).format(product.publicPrice) +
                    " " +
                    product.currency
                  : "Precio por confirmar"}
              </p>
              <p className="muted small">
                {product.deliveryDays !== null
                  ? `Entrega estimada: ${product.deliveryMinDays ?? product.deliveryDays}–${product.deliveryDays} días`
                  : "Entrega por confirmar"}
              </p>
              <details>
                <summary>Ver detalles</summary>
                <p className="muted">{product.description}</p>
                <p className="muted small">
                  Disponibilidad y entrega se confirman según cantidad y
                  destino.
                </p>
              </details>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
