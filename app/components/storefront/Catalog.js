import Icon from "./Icons";
import { ProductImage } from "./Dialogs";
import {
  classificationLabel,
  subcategoriesFor,
} from "../../../packages/core/categories.mjs";
import { whatsappContactUrl } from "../../../packages/core/contact.mjs";
import {
  STORE_CATEGORIES,
  selectStoreProducts,
  canSortByPrice,
  deliveryLabel,
  publicPriceLabel,
} from "../../../packages/core/storefront.mjs";
export default function Catalog({
  products,
  filtered,
  unavailable,
  whatsappNumber,
  onQuote,
  category,
  subcategory,
  query,
  sort,
  onCategory,
  onSubcategory,
  onQuery,
  onSort,
  onReset,
  onProduct,
  searchRef,
}) {
  const pendingCategory =
    !unavailable &&
    (!products.length ||
      (category !== "Todos" &&
        !selectStoreProducts(products, { category, subcategory }).length));
  const whatsappUrl = whatsappContactUrl(whatsappNumber, {
    category,
    subcategory,
  });
  return (
    <section
      className="sf-catalog sf-container"
      id="catalogo"
      aria-labelledby="catalog-title"
    >
      <div className="sf-catalog-heading">
        <div>
          <p className="sf-eyebrow">Encuentra tu favorito</p>
          <h2 id="catalog-title" tabIndex={-1}>
            Pequeños detalles.
            <br className="sf-heading-break" /> Grandes sonrisas.
          </h2>
        </div>
        <div className="sf-search">
          <Icon name="search" size={19} />
          <input
            id="product-search"
            ref={searchRef}
            type="search"
            placeholder="Buscar un detalle…"
            aria-label="Buscar productos"
            value={query}
            maxLength={240}
            onChange={(event) => onQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              className="sf-icon-button"
              onClick={() => {
                onQuery("");
                searchRef.current?.focus();
              }}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="sf-catalog-toolbar">
        <label className="sf-category-picker">
          <span className="sr-only">Categoría del catálogo</span>
          <select
            aria-label="Categoría del catálogo"
            value={category}
            onChange={(event) => onCategory(event.target.value)}
          >
            {STORE_CATEGORIES.map((name) => (
              <option key={name}>{name}</option>
            ))}
            {!STORE_CATEGORIES.includes(category) && (
              <option>{category}</option>
            )}
          </select>
        </label>
        <div className="sf-category-tabs" role="group" aria-label="Categorías">
          {STORE_CATEGORIES.map((name) => (
            <button
              type="button"
              key={name}
              aria-pressed={category === name}
              className={category === name ? "is-active" : ""}
              onClick={() => onCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="sf-sort">
          <span className="sr-only">Ordenar productos</span>
          <select
            aria-label="Ordenar productos"
            value={sort}
            onChange={(event) => onSort(event.target.value)}
          >
            <option value="recent">Más recientes</option>
            <option value="name">Nombre: A–Z</option>
            {canSortByPrice(products) && (
              <>
                <option value="price-low">Menor precio</option>
                <option value="price-high">Mayor precio</option>
              </>
            )}
          </select>
          <Icon name="chevron" size={14} />
        </label>
      </div>
      {category !== "Todos" && !STORE_CATEGORIES.includes(category) && (
        <div className="sf-catalog-context">
          <span>Colección: {category}</span>
          <button
            type="button"
            className="sf-inline-link"
            onClick={() => onCategory("Todos")}
          >
            Ver todas las categorías
          </button>
        </div>
      )}
      {subcategoriesFor(category).length > 0 && (
        <label className="sf-subcategory-filter">
          <span>Subcategoría de {category}</span>
          <select
            aria-label={"Subcategoría de " + category}
            value={subcategory}
            onChange={(event) => onSubcategory(event.target.value)}
          >
            <option value="">Ver todo en {category}</option>
            {subcategoriesFor(category).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      <div
        className="sf-catalog-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {products.length > 0
          ? `${filtered.length} ${filtered.length === 1 ? "detalle" : "detalles"}${category !== "Todos" ? " · " + category : ""}${subcategory ? " · " + subcategory : ""}`
          : ""}
      </div>
      {!filtered.length && (
        <div
          className="sf-catalog-empty"
          role={unavailable ? "alert" : undefined}
        >
          {!pendingCategory && (
            <Icon name={products.length ? "search" : "gift"} size={52} />
          )}
          <h3>
            {pendingCategory
              ? subcategory ||
                (category === "Todos" ? "Próximamente" : category)
              : unavailable
                ? "El catálogo estará de vuelta"
                : products.length
                  ? "Ese detalle aún no aparece"
                  : "Lo bonito está por llegar"}
          </h3>
          <p>
            {pendingCategory ? (
              "Estamos trabajando para brindarte estas opciones de souvenir"
            ) : unavailable ? (
              "No pudimos cargar los detalles en este momento. Inténtalo de nuevo en unos minutos."
            ) : products.length ? (
              "Prueba otro nombre o explora una categoría diferente."
            ) : (
              <>
                Estamos preparando una selección de detalles para ti.
                <br />
                Vuelve pronto para descubrirla.
              </>
            )}
          </p>
          {pendingCategory ? (
            <>
              <p>Escríbenos por WhatsApp y cuéntanos qué souvenir necesitas.</p>
              {whatsappUrl ? (
                <a
                  className="sf-button sf-whatsapp-contact"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Consultar por WhatsApp <Icon name="arrow" size={18} />
                </a>
              ) : (
                <button type="button" className="sf-button" onClick={onQuote}>
                  Solicitar información
                </button>
              )}
            </>
          ) : unavailable ? (
            <button
              type="button"
              className="sf-inline-link"
              onClick={() => window.location.reload()}
            >
              Volver a intentar <Icon name="arrow" size={19} />
            </button>
          ) : products.length ? (
            <button type="button" className="sf-inline-link" onClick={onReset}>
              Ver todos los detalles <Icon name="arrow" size={19} />
            </button>
          ) : (
            <a href="#categorias" className="sf-inline-link">
              Explorar nuestras categorías <Icon name="arrow" size={19} />
            </a>
          )}
        </div>
      )}
      {filtered.length > 0 && (
        <div className="sf-product-grid">
          {filtered.map((product) => (
            <article className="sf-product" key={product.id}>
              <button
                className="sf-product-cover"
                type="button"
                aria-label={"Ver detalles de " + product.title}
                onClick={() => onProduct(product)}
              >
                <ProductImage
                  src={product.images?.[0]}
                  alt={product.title}
                  width="400"
                  height="440"
                  loading="lazy"
                />
                {product.personalizationSupported && (
                  <span className="sf-product-personal">
                    <Icon name="pencil" size={14} />
                    Personalizable
                  </span>
                )}
              </button>
              <div className="sf-product-copy">
                <span className="sf-product-category">
                  {classificationLabel(product)}
                </span>
                <h3>
                  <button type="button" onClick={() => onProduct(product)}>
                    {product.title}
                  </button>
                </h3>
                <p className="sf-product-price">{publicPriceLabel(product)}</p>
                <p className="sf-product-delivery">{deliveryLabel(product)}</p>
                <button
                  type="button"
                  className="sf-inline-link"
                  onClick={() => onProduct(product)}
                >
                  Ver detalles <Icon name="arrow" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
