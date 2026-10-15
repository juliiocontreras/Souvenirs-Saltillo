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

export default function Storefront({
  products,
  unavailable,
  initialFilters = readStoreFilters(),
}) {
  const [category, setCategory] = useState(initialFilters.category);
  const [query, setQuery] = useState(initialFilters.query);
  const [sort, setSort] = useState(initialFilters.sort);
  const [product, setProduct] = useState(null),
    [faq, setFaq] = useState(false);
  const searchRef = useRef(null);
  const validSort =
    sort.startsWith("price-") && !canSortByPrice(products) ? "recent" : sort;
  const filtered = selectStoreProducts(products, {
    category,
    query,
    sort: validSort,
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    category === "Todos"
      ? url.searchParams.delete("categoria")
      : url.searchParams.set("categoria", category);
    query ? url.searchParams.set("q", query) : url.searchParams.delete("q");
    validSort === "recent"
      ? url.searchParams.delete("orden")
      : url.searchParams.set("orden", validSort);
    window.history.replaceState(null, "", url);
  }, [category, query, validSort]);
  useEffect(() => {
    function restore() {
      const state = readStoreFilters(
        new URLSearchParams(window.location.search),
      );
      setCategory(state.category);
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
    setQuery("");
    setSort("recent");
    window.history.pushState(null, "", categoryHref(nextCategory));
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "auto" });
    document.getElementById("catalog-title")?.focus({ preventScroll: true });
  }
  function reset() {
    setCategory("Todos");
    setQuery("");
    setSort("recent");
  }
  return (
    <div className="storefront">
      <Header
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
          query={query}
          sort={validSort}
          onCategory={setCategory}
          onQuery={setQuery}
          onSort={setSort}
          onReset={reset}
          onProduct={setProduct}
          searchRef={searchRef}
        />
        <Personalization onCategory={navigateCategory} />
        <About />
      </main>
      <Footer onCategory={navigateCategory} onFaq={() => setFaq(true)} />
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
