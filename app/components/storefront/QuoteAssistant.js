"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icons";
import {
  PRODUCT_CATEGORY_NAMES,
  subcategoriesFor,
} from "../../../packages/core/categories.mjs";
import {
  ContactFields,
  OrderFields,
  DeliveryFields,
  ReviewFields,
} from "./QuoteFields";
import {
  LOGO_MAX_BYTES,
  validateQuote,
} from "../../../packages/core/quotes.mjs";
import {
  selectStoreProducts,
  publicPriceLabel,
} from "../../../packages/core/storefront.mjs";
import { quoteSelection, applyQuoteSelection } from "../../../packages/core/quote-context.mjs";

const steps = ["Contacto", "Pedido", "Diseño y entrega", "Revisar"];
const initial = () => ({
  id: "",
  name: "",
  company: "",
  preferredContact: "WhatsApp",
  phone: "",
  email: "",
  category: "",
  subcategory: "",
  quantity: "",
  description: "",
  budget: "",
  logoStatus: "",
  deliveryDate: "",
  deliveryFlexible: false,
  location: "",
  urgency: "",
  invoice: "",
  consent: false,
});

export default function QuoteAssistant({
  open,
  onClose,
  products,
  onCategory,
  context,
}) {
  const [value, setValue] = useState(initial);
  const [step, setStep] = useState(0),
    [logo, setLogo] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const ref = useRef(null),
    body = useRef(null),
    form = useRef(null),
    heading = useRef(null),
    submitted = useRef(false);
  useEffect(() => {
    if (!open) {
      if (ref.current?.open) ref.current.close();
      return;
    }
    const selection = quoteSelection(context);
    if (!value.id || (receipt && selection.label)) {
      setValue(applyQuoteSelection({ ...initial(), id: crypto.randomUUID() }, selection));
      setStep(0);
      setLogo(null);
      setReceipt(null);
      setError("");
      setPendingSelection(null);
    } else {
      const changed = selection.label && (
        (selection.category && (selection.category !== value.category || selection.subcategory !== value.subcategory)) ||
        (selection.description && !value.description.includes(selection.description))
      );
      setPendingSelection(changed ? selection : null);
    }
    ref.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, context]);
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    if (open) heading.current?.focus({ preventScroll: true });
  }, [step, receipt, open]);
  function change(event) {
    const { name, value: next, type, checked } = event.target;
    setError("");
    setValue((old) => ({
      ...old,
      [name]: type === "checkbox" ? checked : next,
      ...(name === "category" ? { subcategory: "" } : {}),
      ...(name === "deliveryFlexible" && checked ? { deliveryDate: "" } : {}),
    }));
    if (name === "logoStatus" && next !== "Tengo un logo") setLogo(null);
  }
  function chooseLogo(event) {
    const file = event.target.files?.[0] || null;
    if (file && file.size > LOGO_MAX_BYTES) {
      setError("El logo debe pesar hasta 1 MB.");
      event.target.value = "";
      setLogo(null);
      return;
    }
    setError("");
    setLogo(file);
  }
  async function submit(event) {
    event.preventDefault();
    if (
      step === 0 &&
      (!value.name.trim() ||
        (value.phone &&
          (!/^[+\d\s().-]+$/.test(value.phone) ||
            value.phone.replace(/\D/g, "").length < 8 ||
            value.phone.replace(/\D/g, "").length > 15)))
    ) {
      setError("Revisa tu nombre y teléfono con lada.");
      return;
    }
    if (step === 1 && !value.description.trim()) {
      setError("Cuéntanos las características de tu pedido.");
      return;
    }
    if (step < 3) {
      setError("");
      setStep(step + 1);
      return;
    }
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const fields = validateQuote({
        ...value,
        quantity: Number(value.quantity),
      });
      const data = new FormData();
      data.set("details", JSON.stringify(fields));
      data.set("website", new FormData(form.current).get("website") || "");
      if (logo) data.set("logo", logo);
      const response = await fetch("/api/quotes", {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ||
            "No pudimos guardar la solicitud. Inténtalo de nuevo.",
        );
      setReceipt(result.receipt);
    } catch (failure) {
      setError(
        failure.name === "TimeoutError" || failure.name === "TypeError"
          ? "No pudimos confirmar el envío. Conservamos tus datos para que puedas reintentar sin duplicar la solicitud."
          : failure.message ||
              "No pudimos guardar la solicitud. Conservamos tus datos para que puedas reintentar.",
      );
    } finally {
      submitted.current = false;
      setBusy(false);
    }
  }
  const matches = receipt
    ? selectStoreProducts(products, {
        category: value.category || "Todos",
        subcategory: value.subcategory,
      })
        .filter(
          (product) =>
            value.logoStatus === "Sin logo" ||
            value.logoStatus === "Por definir" ||
            product.personalizationSupported,
        )
        .slice(0, 3)
    : [];
  return (
    <dialog
      ref={ref}
      className="sf-quote-dialog"
      aria-labelledby="quote-heading"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        if (!busy && event.target === ref.current) onClose();
      }}
    >
      <div className="sf-quote-header">
        <div>
          <h2 id="quote-heading">Tu próximo detalle empieza aquí</h2>
          <p>Asistente de cotización · Atención automática</p>
        </div>
        <button
          type="button"
          className="sf-icon-button"
          aria-label="Cerrar asistente"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="sf-quote-body" ref={body}>
        {!receipt ? (
          <>
            {pendingSelection && (
              <aside className="sf-quote-context" aria-label="Nueva selección para tu solicitud">
                <p>Ya tienes una solicitud en curso. ¿Quieres usar esta selección?</p>
                <strong>{pendingSelection.label}</strong>
                <p>Conservaremos tus datos de contacto y los detalles que ya escribiste.</p>
                <div className="sf-quote-actions">
                  <button type="button" className="sf-button sf-button-outline" disabled={busy} onClick={() => {
                    try {
                      const updated = applyQuoteSelection(value, pendingSelection);
                      setValue(updated);
                      setPendingSelection(null);
                      setError("");
                      setStep(Math.min(step, 1));
                    } catch (failure) {
                      setError(failure.message);
                    }
                  }}>Usar esta selección</button>
                  <button type="button" className="sf-inline-link" disabled={busy} onClick={() => setPendingSelection(null)}>Continuar mi solicitud</button>
                </div>
              </aside>
            )}
            <p className="sf-quote-step" ref={heading} tabIndex={-1}>
              Paso {step + 1} de 4
            </p>
            <ol
              className="sf-quote-progress"
              aria-label="Pasos de tu cotización"
            >
              {steps.map((name, index) => (
                <li
                  key={name}
                  aria-current={step === index ? "step" : undefined}
                >
                  <span>{index + 1}</span>
                  {name}
                </li>
              ))}
            </ol>
            <form ref={form} onSubmit={submit}>
              <div hidden aria-hidden="true">
                <label>
                  Sitio web
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <fieldset disabled={busy}>
                {step === 0 && <ContactFields value={value} change={change} />}
                {step === 1 && <OrderFields value={value} change={change} />}
                {step === 2 && (
                  <DeliveryFields
                    value={value}
                    change={change}
                    logo={logo}
                    onLogo={chooseLogo}
                  />
                )}
                {step === 3 && (
                  <ReviewFields value={value} change={change} logo={logo} />
                )}
              </fieldset>
              {error && (
                <p role="alert" className="sf-quote-error">
                  {error}
                </p>
              )}
              <div className="sf-quote-actions">
                {step > 0 && (
                  <button
                    type="button"
                    className="sf-button sf-button-outline"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setStep(step - 1);
                    }}
                  >
                    Atrás
                  </button>
                )}
                <button type="submit" className="sf-button" disabled={busy}>
                  {busy
                    ? "Guardando…"
                    : step === 3
                      ? "Enviar solicitud"
                      : "Continuar"}
                  <Icon name="arrow" size={18} />
                </button>
              </div>
              <p className="sf-quote-note">
                Usaremos tus datos para atender esta cotización.
              </p>
            </form>
          </>
        ) : (
          <div className="sf-quote-success">
            <h3 ref={heading} tabIndex={-1}>
              Tu idea ya tiene un comienzo.
            </h3>
            <p>
              Guardamos tu solicitud con el folio{" "}
              <strong>{receipt.reference}</strong>.
            </p>
            <p>
              El equipo revisará tu pedido y te contactará por{" "}
              {value.preferredContact.toLowerCase()} para confirmar opciones y
              condiciones.
            </p>
            {matches.length ? (
              <>
                <h4>Artículos que puedes explorar</h4>
                <ul>
                  {matches.map((product) => (
                    <li key={product.id}>
                      <strong>{product.title}</strong>
                      <span>{publicPriceLabel(product)}</span>
                    </li>
                  ))}
                </ul>
                <a
                  className="sf-button"
                  href={
                    value.category
                      ? "/?categoria=" +
                        encodeURIComponent(value.category) +
                        "#catalogo"
                      : "/#catalogo"
                  }
                  onClick={(event) => {
                    onCategory(event, value.category || "Todos");
                    onClose();
                  }}
                >
                  Ver opciones del catálogo
                </a>
              </>
            ) : (
              <>
                <h4>Líneas para tu cotización</h4>
                <ul>
                  {(value.subcategory
                    ? [value.subcategory]
                    : subcategoriesFor(value.category).length
                      ? subcategoriesFor(value.category)
                      : value.category
                        ? [value.category]
                        : PRODUCT_CATEGORY_NAMES
                  ).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p>
                  Estamos completando el catálogo. Con estos datos prepararemos
                  opciones para tu cotización; no necesitas esperar a que todos
                  los artículos estén publicados. La disponibilidad y
                  personalización de estas líneas se confirman al cotizar.
                </p>
              </>
            )}
            <p className="sf-quote-note">
              La solicitud no confirma existencias ni una fecha de entrega.
            </p>
            <button
              type="button"
              className="sf-button sf-button-outline"
              onClick={() => {
                setValue(applyQuoteSelection({ ...initial(), id: crypto.randomUUID() }, quoteSelection(context)));
                setLogo(null);
                setReceipt(null);
                setPendingSelection(null);
                setError("");
                setStep(0);
              }}
            >
              Crear otra solicitud
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
