"use client";
import { useEffect, useRef, useState } from "react";
import Icon, { Wordmark } from "./Icons";
import { categoryHref } from "../../../packages/core/storefront.mjs";
import { PRODUCT_CATEGORIES } from "../../../packages/core/categories.mjs";

export default function Header({ onCategory, onSearch, onQuote }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef(null),
    menuButton = useRef(null),
    catalog = useRef(null),
    occasions = useRef(null);
  useEffect(() => {
    function closeOutside(event) {
      if (!header.current?.contains(event.target)) {
        setMenuOpen(false);
        if (occasions.current) occasions.current.open = false;
        if (catalog.current) catalog.current.open = false;
      }
    }
    function escape(event) {
      if (event.key !== "Escape") return;
      if (catalog.current?.open) {
        catalog.current.open = false;
        catalog.current.querySelector("summary")?.focus();
      } else if (occasions.current?.open) {
        occasions.current.open = false;
        occasions.current.querySelector("summary")?.focus();
      } else if (menuOpen) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    function desktop(event) {
      if (event.matches) {
        setMenuOpen(false);
        if (catalog.current) catalog.current.open = false;
        if (occasions.current) occasions.current.open = false;
      }
    }
    const media = window.matchMedia("(min-width: 1041px)");
    media.addEventListener("change", desktop);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      media.removeEventListener("change", desktop);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);
  function closeMenus() {
    setMenuOpen(false);
    if (occasions.current) occasions.current.open = false;
    if (catalog.current) catalog.current.open = false;
  }
  function choose(event, category) {
    onCategory(event, category);
    closeMenus();
  }
  return (
    <header className="sf-header" ref={header}>
      <div className="sf-announcement">
        Detalles que se convierten en recuerdos
      </div>
      <div className="sf-container sf-nav-row">
        <Wordmark />
        <nav
          id="store-navigation"
          className={"sf-navigation" + (menuOpen ? " is-open" : "")}
          aria-label="Navegación principal"
        >
          <a
            className="sf-nav-home"
            href="/"
            aria-current="page"
            onClick={closeMenus}
          >
            Inicio
          </a>
          <details
            className="sf-occasions sf-catalog-menu"
            ref={catalog}
            onToggle={(event) => {
              if (event.currentTarget.open && occasions.current)
                occasions.current.open = false;
            }}
          >
            <summary>
              Catálogo <Icon name="chevron" size={13} />
            </summary>
            <nav
              className="sf-catalog-dropdown"
              aria-label="Categorías del catálogo"
            >
              <a
                className="sf-catalog-all"
                href={categoryHref("Todos")}
                onClick={(event) => choose(event, "Todos")}
              >
                Ver todo el catálogo <Icon name="arrow" size={16} />
              </a>
              {PRODUCT_CATEGORIES.map(({ name, subcategories }) => (
                <a
                  key={name}
                  href={categoryHref(name)}
                  onClick={(event) => choose(event, name)}
                >
                  <span>{name}</span>
                  {subcategories.length > 0 && (
                    <small>{subcategories.join(", ")}</small>
                  )}
                </a>
              ))}
            </nav>
          </details>
          <details
            className="sf-occasions"
            ref={occasions}
            onToggle={(event) => {
              if (event.currentTarget.open && catalog.current)
                catalog.current.open = false;
            }}
          >
            <summary>
              Ocasiones <Icon name="chevron" size={13} />
            </summary>
            <div className="sf-occasion-menu">
              <a
                href={categoryHref("Regalos")}
                onClick={(event) => choose(event, "Regalos")}
              >
                <span>Para alguien especial</span>
                <small>Regalos para celebrar y compartir</small>
              </a>
              <a
                href={categoryHref("Personalizados")}
                onClick={(event) => choose(event, "Personalizados")}
              >
                <span>Para hacerlo único</span>
                <small>Detalles con un toque personal</small>
              </a>
              <a
                href={categoryHref("Empresas y eventos")}
                onClick={(event) => choose(event, "Empresas y eventos")}
              >
                <span>Para tu equipo o evento</span>
                <small>Recuerdos para compartir en grande</small>
              </a>
            </div>
          </details>
          <a
            href={categoryHref("Personalizados")}
            onClick={(event) => choose(event, "Personalizados")}
          >
            Personalizados
          </a>
          <a href="#nosotros" onClick={closeMenus}>
            Nosotros
          </a>
          <a
            href="#cotizar"
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              )
                return;
              event.preventDefault();
              closeMenus();
              onQuote();
            }}
          >
            Cotizar
          </a>
        </nav>
        <div className="sf-header-actions">
          <button
            type="button"
            className="sf-icon-button"
            aria-label="Buscar en el catálogo"
            onClick={() => {
              closeMenus();
              onSearch();
            }}
          >
            <Icon name="search" />
          </button>
          <a
            className="sf-icon-button"
            href="/login"
            aria-label="Acceder al panel de tienda"
          >
            <Icon name="user" />
          </a>
          <button
            type="button"
            ref={menuButton}
            className="sf-icon-button sf-menu-toggle"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="store-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}
