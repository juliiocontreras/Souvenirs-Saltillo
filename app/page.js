import { catalogRepository } from "../lib/catalog-store.mjs";
import Storefront from "./components/Storefront";
export const dynamic = "force-dynamic";
export default async function Home() {
  let products = [],
    unavailable = false;
  try {
    products = await catalogRepository.listPublicProducts();
  } catch {
    unavailable = true;
  }
  return (
    <main className="shell">
      <nav className="nav">
        <a href="/" className="brand">
          Souvenirs Saltillo
        </a>
        <div className="actions">
          <a className="text-link" href="#catalogo">
            Catálogo
          </a>
          <a className="ghost btn" href="/login">
            Administración
          </a>
        </div>
      </nav>
      <section className="hero" id="contenido" tabIndex={-1}>
        <p className="eyebrow">Detalles que hablan de Saltillo</p>
        <h1>Souvenirs con identidad.</h1>
        <p className="muted">
          Artículos para regalo, personalizados y detalles para empresas y
          eventos. Encuentra tu próxima idea en nuestro catálogo.
        </p>
        <a href="#catalogo" className="btn hero-cta">
          Explorar catálogo
        </a>
      </section>
      <Storefront products={products} unavailable={unavailable} />
      <footer className="store-footer">
        <a className="brand" href="/">
          Souvenirs Saltillo
        </a>
        <p className="muted small">
          La entrega y disponibilidad se confirman según cantidad,
          personalización y destino.
        </p>
      </footer>
    </main>
  );
}
