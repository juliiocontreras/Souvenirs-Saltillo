"use client";
import { useEffect, useRef, useState } from "react";
import {
  readStoreFilters,
  selectStoreProducts,
  categoryHref,
  canSortByPrice,
} from "../../packages/core/storefront.mjs";
import Header from "./storefront/Header";
import {
  Hero,
  Collections,
  Personalization,
  About,
  Footer,
} from "./storefront/Sections";
import Catalog from "./storefront/Catalog";
import { ProductDialog, FaqDialog } from "./storefront/Dialogs";
import QuoteAssistant from "./storefront/QuoteAssistant";
import Icon from "./storefront/Icons";

export default function Storefront({
  products,
  unavailable,
  initialFilters = readStoreFilters(),
}) {
  const [category, setCategory] = useState(initialFilters.category);
  const [subcategory, setSubcategory] = useState(
    initialFilters.subcategory || "",
  );
  const [query, setQuery] = useState(initialFilters.query);
  const [sort, setSort] = useState(initialFilters.sort);
  const [product, setProduct] = useState(null),
    [faq, setFaq] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  useEffect(() => {
    const openFromHash = () => {
      if (
        window.location.hash === "#personaliza" ||
        window.location.hash === "#cotizar"
      )
        setQuoteOpen(true);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);
  function closeQuote() {
    setQuoteOpen(false);
    if (["#personaliza", "#cotizar"].includes(window.location.hash))
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
  }
  const searchRef = useRef(null);
  const validSort =
    sort.startsWith("price-") && !canSortByPrice(products) ? "recent" : sort;
  const filtered = selectStoreProducts(products, {
    category,
    subcategory,
    query,
    sort: validSort,
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    category === "Todos"
      ? url.searchParams.delete("categoria")
      : url.searchParams.set("categoria", category);
    subcategory
      ? url.searchParams.set("subcategoria", subcategory)
      : url.searchParams.delete("subcategoria");
    query ? url.searchParams.set("q", query) : url.searchParams.delete("q");
    validSort === "recent"
      ? url.searchParams.delete("orden")
      : url.searchParams.set("orden", validSort);
    window.history.replaceState(null, "", url);
  }, [category, subcategory, query, validSort]);
  useEffect(() => {
    function restore() {
      const state = readStoreFilters(
        new URLSearchParams(window.location.search),
      );
      setCategory(state.category);
      setSubcategory(state.subcategory);
      setQuery(state.query);
      setSort(state.sort);
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function navigateCategory(event, nextCategory) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    setCategory(nextCategory);
    setSubcategory("");
    setQuery("");
    setSort("recent");
    window.history.pushState(null, "", categoryHref(nextCategory));
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "auto" });
    document.getElementById("catalog-title")?.focus({ preventScroll: true });
  }
  function reset() {
    setCategory("Todos");
    setSubcategory("");
    setQuery("");
    setSort("recent");
  }
  return (
    <div className="storefront">
      <Header
        onQuote={() => setQuoteOpen(true)}
        onCategory={navigateCategory}
        onSearch={() => {
          document
            .getElementById("catalogo")
            ?.scrollIntoView({ behavior: "auto" });
          searchRef.current?.focus({ preventScroll: true });
        }}
      />
      <main id="contenido" tabIndex={-1}>
        <Hero onCategory={navigateCategory} />
        <Collections onCategory={navigateCategory} />
        <Catalog
          products={products}
          filtered={filtered}
          unavailable={unavailable}
          category={category}
          subcategory={subcategory}
          query={query}
          sort={validSort}
          onCategory={(value) => {
            setCategory(value);
            setSubcategory("");
          }}
          onSubcategory={setSubcategory}
          onQuery={setQuery}
          onSort={setSort}
          onReset={reset}
          onProduct={setProduct}
          searchRef={searchRef}
        />
        <Personalization
          onCategory={navigateCategory}
          onQuote={() => setQuoteOpen(true)}
        />
        <About />
      </main>
      <Footer onCategory={navigateCategory} onFaq={() => setFaq(true)} />
      <button
        type="button"
        className="sf-quote-launcher"
        onClick={() => setQuoteOpen(true)}
        aria-haspopup="dialog"
        aria-label="Cotiza tu idea"
      >
        <Icon name="chat" size={24} className="sf-quote-launcher-icon" />
        <span className="sf-quote-launcher-text">
          Cotiza tu idea <small>Atención automática</small>
        </span>
      </button>
      <QuoteAssistant
        open={quoteOpen}
        onClose={closeQuote}
        products={products}
        onCategory={navigateCategory}
      />
      {product && (
        <ProductDialog
          key={product.id}
          product={product}
          onClose={() => setProduct(null)}
        />
      )}
      {faq && <FaqDialog onClose={() => setFaq(false)} />}
    </div>
  );
}
