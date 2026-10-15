"use client";
import { useEffect, useState } from "react";
import { QUOTE_STATUSES } from "../../packages/core/quotes.mjs";
import { classificationLabel } from "../../packages/core/categories.mjs";

export default function QuoteInbox() {
  const [quotes, setQuotes] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    load();
  }, []);
  async function load() {
    setBusy("load");
    setError("");
    try {
      const response = await fetch("/api/quotes");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setQuotes(result.quotes);
    } catch (failure) {
      setError(failure.message || "No pudimos cargar las solicitudes.");
    } finally {
      setBusy("");
    }
  }
  async function status(id, value) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setQuotes((old) =>
        old.map((quote) =>
          quote.id === id ? { ...quote, status: value } : quote,
        ),
      );
    } catch (failure) {
      setError(failure.message || "No pudimos guardar el estado.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section id="cotizaciones" className="quote-inbox">
      <div className="section-heading">
        <div>
          <h2>Solicitudes de cotización</h2>
          <p className="muted">
            Pedidos recibidos por el asistente de la tienda. Últimas 200
            solicitudes.
          </p>
        </div>
        <button
          type="button"
          className="btn ghost"
          disabled={Boolean(busy)}
          onClick={load}
        >
          {busy === "load"
            ? "Cargando…"
            : quotes === null
              ? "Ver solicitudes"
              : "Actualizar solicitudes"}
        </button>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {quotes?.length === 0 && (
        <p className="card empty">
          Aún no hay solicitudes. El asistente está listo para recibirlas.
        </p>
      )}
      {quotes?.map((quote) => (
        <article className="card quote-request" key={quote.id}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{quote.reference}</p>
              <h3>{quote.name}</h3>
              <p className="muted">
                {quote.company || "Cliente particular"} ·{" "}
                {new Intl.DateTimeFormat("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/Mexico_City",
                }).format(new Date(quote.createdAt))}
              </p>
            </div>
            <span
              className={"badge " + (quote.urgency !== "Normal" ? "" : "good")}
            >
              {quote.urgency}
            </span>
          </div>
          <dl className="product-facts">
            <div>
              <dt>Pedido</dt>
              <dd>
                {classificationLabel({
                  category: quote.category || "Por definir",
                  subcategory: quote.subcategory,
                })}{" "}
                · {quote.quantity} piezas
              </dd>
            </div>
            <div>
              <dt>Entrega deseada</dt>
              <dd>
                {quote.deliveryDate || "Por definir"} · {quote.location}
              </dd>
            </div>
            <div>
              <dt>Factura</dt>
              <dd>{quote.invoice}</dd>
            </div>
            <div>
              <dt>Presupuesto</dt>
              <dd>{quote.budget || "Por definir"}</dd>
            </div>
          </dl>
          <p className="quote-description">{quote.description}</p>
          <p>
            Logo: {quote.logoStatus}
            {quote.logo ? " · " + quote.logo.name : ""}
          </p>
          <div className="actions">
            {quote.phone && (
              <a
                className="text-link"
                href={
                  quote.preferredContact === "WhatsApp"
                    ? "https://wa.me/" + quote.phone.replace(/\D/g, "")
                    : "tel:" + quote.phone.replace(/[^+\d]/g, "")
                }
                target={
                  quote.preferredContact === "WhatsApp" ? "_blank" : undefined
                }
                rel="noopener noreferrer"
              >
                {quote.preferredContact === "WhatsApp"
                  ? "WhatsApp: "
                  : "Teléfono: "}
                {quote.phone}
              </a>
            )}
            {quote.email && (
              <a className="text-link" href={"mailto:" + quote.email}>
                {quote.email}
              </a>
            )}
            {quote.logo && (
              <a className="text-link" href={`/api/quotes/${quote.id}/logo`}>
                Descargar logo
              </a>
            )}
          </div>
          <label className="field quote-status">
            Seguimiento
            <select
              aria-label="Seguimiento"
              value={quote.status}
              disabled={Boolean(busy)}
              onChange={(event) => status(quote.id, event.target.value)}
            >
              {QUOTE_STATUSES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <small className="muted">
            Contacto preferido: {quote.preferredContact}. Autorización de
            contacto registrada al enviar la solicitud.
          </small>
        </article>
      ))}
    </section>
  );
}
