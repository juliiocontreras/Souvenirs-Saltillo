import Icon, { Wordmark } from "./Icons";
import { categoryHref } from "../../../packages/core/storefront.mjs";
import { PRODUCT_CATEGORY_NAMES } from "../../../packages/core/categories.mjs";
export function Hero({ onCategory }) {
  return (
    <>
      <section className="sf-hero" aria-labelledby="hero-title">
        <img
          className="sf-hero-photo"
          src="/images/backpack-hero.webp"
          alt="Mochila beige con correas verde olivo y un sol bordado en dorado."
          width="2172"
          height="724"
          fetchPriority="high"
        />
        <div className="sf-container sf-hero-inner">
          <div className="sf-hero-copy">
            <h1 id="hero-title">
              Hay detalles
              <br />
              <em>que lo dicen todo.</em>
            </h1>
            <p>
              Regalos, detalles personalizados y recuerdos para celebrar a
              quienes más quieres.
            </p>
            <div className="sf-hero-actions">
              <a
                className="sf-button"
                href={categoryHref("Todos")}
                onClick={(event) => onCategory(event, "Todos")}
              >
                Explorar catálogo
              </a>
              <a
                className="sf-button sf-button-outline"
                href={categoryHref("Personalizados")}
                onClick={(event) => onCategory(event, "Personalizados")}
              >
                Hazlo personal
              </a>
            </div>
            <span className="sf-hero-note">
              Hecho para regalar. Pensado para recordar.
            </span>
          </div>
        </div>
      </section>
      <div className="sf-benefits" aria-label="Detalles de nuestra tienda">
        <div className="sf-container sf-benefits-inner">
          <div>
            <Icon name="gift" size={39} />
            <span>
              <strong>Detalles con intención</strong>
              <small>Regalos que transmiten lo que sientes.</small>
            </span>
          </div>
          <div>
            <Icon name="pencil" size={39} />
            <span>
              <strong>Personalización a tu estilo</strong>
              <small>Convierte tus ideas en algo único.</small>
            </span>
          </div>
          <div>
            <Icon name="sprig" size={39} />
            <span>
              <strong>Para cada ocasión</strong>
              <small>Cumpleaños, bodas, eventos y más.</small>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
const collections = [
  {
    category: "Regalos",
    image: "gifts-hero.webp",
    position: "78% 50%",
    description: "Regalos envueltos con listones verde olivo",
  },
  {
    category: "Personalizados",
    image: "personalized-gifts.webp",
    position: "76% 45%",
    description: "Caja de madera grabada y detalles para personalizar",
  },
  {
    category: "Empresas y eventos",
    image: "corporate-gifts.webp",
    position: "50% 50%",
    description: "Obsequios coordinados para equipos y celebraciones",
  },
];
export function Collections({ onCategory }) {
  return (
    <section
      className="sf-collections"
      id="categorias"
      aria-labelledby="collections-title"
    >
      <div className="sf-container">
        <div className="sf-centered-heading">
          <h2 id="collections-title">Un detalle para cada historia</h2>
          <p>Encuentra una forma muy tuya de regalar.</p>
        </div>
        <div className="sf-collection-grid">
          {collections.map((item) => (
            <a
              className="sf-collection"
              key={item.category}
              href={categoryHref(item.category)}
              onClick={(event) => onCategory(event, item.category)}
            >
              <div className="sf-collection-image">
                <img
                  src={"/images/" + item.image}
                  alt={item.description}
                  width="280"
                  height="280"
                  loading="lazy"
                  style={{ objectPosition: item.position }}
                />
              </div>
              <h3>{item.category}</h3>
              <span>
                Explorar <Icon name="arrow" size={19} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Personalization({ onCategory, onQuote }) {
  return (
    <section
      className="sf-personal"
      id="personalizacion"
      aria-labelledby="personal-title"
    >
      <img
        className="sf-personal-photo"
        src="/images/personalized-gifts.webp"
        alt="Caja de madera grabada, taza y bolsa de tela junto a un regalo con listón."
        width="1586"
        height="992"
        loading="lazy"
      />
      <div className="sf-container sf-personal-inner">
        <div className="sf-personal-copy">
          <p className="sf-eyebrow">Muy tuyo. Muy especial.</p>
          <h2 id="personal-title">Que lleve un poquito de ti.</h2>
          <p>
            Un nombre, una fecha, una idea. Descubre los detalles que puedes
            hacer únicos.
          </p>
          <div className="sf-personal-actions">
            <a
              className="sf-button"
              href={categoryHref("Personalizados")}
              onClick={(event) => onCategory(event, "Personalizados")}
            >
              Ver personalizables
            </a>
            <button
              type="button"
              className="sf-button sf-button-outline"
              onClick={onQuote}
            >
              Cotizar mi diseño
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
export function About() {
  return (
    <section
      className="sf-about sf-container"
      id="nosotros"
      aria-labelledby="about-title"
    >
      <h2 id="about-title">De Saltillo, para tus momentos especiales.</h2>
      <p>
        Creemos en esos detalles que hacen sonreír, que acompañan una
        celebración y que se convierten en recuerdos. Regalos personales,
        detalles para tu equipo y recuerdos para compartir.
      </p>
    </section>
  );
}
export function Footer({ onCategory, onFaq }) {
  return (
    <footer className="sf-footer">
      <div className="sf-container">
        <div className="sf-footer-main">
          <div className="sf-footer-brand">
            <Wordmark footer />
            <p>Detalles que se convierten en recuerdos.</p>
          </div>
          <nav aria-label="Explora la tienda">
            <h3>Explora</h3>
            {["Todos", ...PRODUCT_CATEGORY_NAMES].map((category) => (
              <a
                key={category}
                href={categoryHref(category)}
                onClick={(event) => onCategory(event, category)}
              >
                {category === "Todos" ? "Catálogo" : category}
              </a>
            ))}
          </nav>
          <nav aria-label="Información para tu visita">
            <h3>Tu visita</h3>
            <a href="#nosotros">Nosotros</a>
            <button type="button" className="sf-footer-link" onClick={onFaq}>
              Preguntas frecuentes
            </button>
          </nav>
          <div>
            <h3>Nuestra tienda</h3>
            <p>Saltillo, Coahuila · México</p>
            <a href="/login">Acceso a tienda</a>
          </div>
        </div>
        <div className="sf-footer-bottom">
          <p>
            © {new Date().getFullYear()} Souvenirs Saltillo. Todos los derechos
            reservados.
          </p>
          <p>
            Disponibilidad y entrega sujetas a cantidad, personalización y
            destino.
          </p>
        </div>
      </div>
    </footer>
  );
}
