"use client";
import { useEffect, useState, useRef } from "react";
import ClassificationFields from "./ClassificationFields";
import ProductClassificationEditor from "./ProductClassificationEditor";
import QuoteInbox from "./QuoteInbox";
import ContactSettings from "./ContactSettings";
import { classificationLabel } from "../../packages/core/categories.mjs";
import { importSummary } from "../../packages/core/imports.mjs";

const date = (value) =>
  value
    ? new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(new Date(value))
    : "Pendiente";
const money = (value, currency) =>
  value === null || value === undefined
    ? "Pendiente"
    : `${Number(value).toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${currency || ""}`;
const statusNames = {
  ok: "Sin cambios",
  changed: "Cambios por revisar",
  removed: "Enlace retirado",
  blocked: "Consulta bloqueada",
  rate_limited: "Límite del proveedor",
  incomplete: "Datos incompletos",
  transient_error: "Error temporal",
  identity_review: "Variante por revisar",
  currency_review: "Moneda por revisar",
  restricted: "Rastreo restringido",
  extraction_failed: "Ficha no extraíble",
  unsafe_url: "Destino no permitido",
};
async function api(path, body, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la operación.");
  return result;
}
function editFrom(option, margin, approved) {
  const fields = { ...option, ...approved?.overrides };
  return {
    title: fields.title || "",
    description: fields.description || "",
    images: (fields.images || []).join("\n"),
    supplierCost: fields.supplierCost ?? "",
    currency: fields.currency || "",
    deliveryDays: fields.deliveryDays ?? "",
    deliveryMinDays: fields.deliveryMinDays ?? "",
    category: approved?.category || "Regalos",
    subcategory: approved?.subcategory || "",
    personalizationSupported: approved?.personalizationSupported || false,
    publicPrice: approved?.publicPrice ?? "",
    conditionsConfirmed: false,
    marginPercent: margin,
    shipping: 0,
    otherCosts: 0,
    feePercent: 0,
    fixedFee: 0,
    taxPercent: 0,
    rounding: 1,
    ...approved?.pricing,
  };
}

export default function AdminPanel({
  initialProducts,
  initialRuns,
  defaultMargin,
  initialSearchState,
  monitorConfigured,
  initialContactSettings,
  initialImports = [],
}) {
  const [pendingImports, setPendingImports] = useState(initialImports);
  const [reviewedCandidates, setReviewedCandidates] = useState({});
  const [searchState, setSearchState] = useState(initialSearchState);
  const [products, setProducts] = useState(initialProducts),
    [runs, setRuns] = useState(initialRuns),
    [draft, setDraft] = useState(null),
    [selection, setSelection] = useState(0),
    [edit, setEdit] = useState(null),
    [suggested, setSuggested] = useState(null),
    [priceNote, setPriceNote] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [intelligence, setIntelligence] = useState({}),
    [failure, setFailure] = useState(false);
  const previewRef = useRef(null),
    messageRef = useRef(null);
  const policy = edit
    ? Object.fromEntries(
        [
          "marginPercent",
          "shipping",
          "otherCosts",
          "feePercent",
          "fixedFee",
          "taxPercent",
          "rounding",
        ].map((key) => [key, edit[key]]),
      )
    : null;
  function notify(text, error = false) {
    setFailure(error);
    setMessage(text);
  }
  async function refresh() {
    const [catalog, state, inbox] = await Promise.all([
      api("/api/products?scope=admin", null, "GET"),
      api("/api/supplier/runs", null, "GET"),
      api("/api/supplier/import", null, "GET"),
    ]);
    setProducts(catalog.products);
    setRuns(state.runs);
    setSearchState(state.searchState);
    setPendingImports(inbox.imports);
    const openIds = Object.keys(intelligence);
    if (openIds.length) {
      const fresh = await Promise.all(
        openIds.map(async (id) => [
          id,
          await api(`/api/products/${id}/supplier-intelligence`, null, "GET"),
        ]),
      );
      setIntelligence(Object.fromEntries(fresh));
    }
  }
  async function perform(key, operation) {
    setBusy(key);
    setMessage("");
    setFailure(false);
    try {
      await operation();
    } catch (error) {
      notify(error.message, true);
    } finally {
      setBusy("");
    }
  }
  function loadDraft(value) {
    if (value.status === "preview") {
      setPendingImports(old => [importSummary(value), ...old.filter(item => item.id !== value.id)]
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    }
    const index = value.selection || 0;
    setDraft(value);
    setSelection(index);
    setEdit(
      editFrom(
        value.options[index],
        defaultMargin,
        value.approvedByIdentity?.[value.options[index].identityKey],
      ),
    );
    setTimeout(
      () =>
        previewRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      50,
    );
  }
  useEffect(() => {
    if (!edit) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (
        edit.supplierCost === "" ||
        !edit.currency ||
        edit.marginPercent === ""
      ) {
        setSuggested(null);
        setPriceNote("Completa costo, moneda y margen.");
        return;
      }
      try {
        const response = await fetch("/api/supplier/pricing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cost: edit.supplierCost, pricing: policy }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setSuggested(result.suggestedPrice);
        setPriceNote("");
      } catch (error) {
        if (error.name !== "AbortError") {
          setSuggested(null);
          setPriceNote(error.message);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    edit?.supplierCost,
    edit?.currency,
    edit?.marginPercent,
    edit?.shipping,
    edit?.otherCosts,
    edit?.feePercent,
    edit?.fixedFee,
    edit?.taxPercent,
    edit?.rounding,
  ]);
  const change = (key) => (event) =>
    setEdit((old) => ({
      ...old,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  async function history(id) {
    await perform("history-" + id, async () => {
      const data = await api(
        `/api/products/${id}/supplier-intelligence`,
        null,
        "GET",
      );
      setIntelligence((old) => ({ ...old, [id]: data }));
    });
  }
  async function monitor() {
    await perform("monitor", async () => {
      let result = await api("/api/supplier/monitor", { force: true });
      for (let batch = 0; result.remaining > 0 && batch < 99; batch++)
        result = await api("/api/supplier/monitor", {});
      await refresh();
      notify(
        result.remaining
          ? "Quedan enlaces pendientes; revisa el historial."
          : "Revisión terminada. Consulta los resultados y cambios pendientes.",
      );
    });
  }
  async function submitPreview(event) {
    event.preventDefault();
    const submitStatus = event.nativeEvent.submitter?.value || "draft";
    await perform("apply", async () => {
      const body = {
        selection,
        title: edit.title,
        description: edit.description,
        images: edit.images
          .split("\n")
          .map((url) => url.trim())
          .filter(Boolean),
        supplierCost: edit.supplierCost === "" ? null : edit.supplierCost,
        currency: edit.currency || null,
        deliveryDays:
          edit.deliveryDays === "" ? null : Number(edit.deliveryDays),
        deliveryMinDays:
          edit.deliveryMinDays === "" ? null : Number(edit.deliveryMinDays),
        category: edit.category,
        subcategory: edit.subcategory,
        personalizationSupported: edit.personalizationSupported,
        publicPrice: edit.publicPrice || null,
        pricing: edit.marginPercent === "" ? {} : policy,
        conditionsConfirmed: edit.conditionsConfirmed,
        status: submitStatus,
      };
      await api(`/api/supplier/import/${draft.id}/apply`, body);
      setDraft(null);
      setEdit(null);
      await refresh();
      notify(
        submitStatus === "published"
          ? "Producto publicado en la tienda."
          : "Producto guardado como borrador.",
      );
    });
  }
  return (
    <main className="shell admin-shell">
      <nav className="nav">
        <a href="/" className="brand">
          Souvenirs Saltillo <small>Administración</small>
        </a>
        <div className="actions">
          <a href="/" className="text-link">
            Ver tienda
          </a>
          <button
            className="btn ghost"
            disabled={Boolean(busy)}
            onClick={() =>
              perform("logout", async () => {
                await api("/api/auth/logout", {});
                window.location.assign("/login");
              })
            }
          >
            Cerrar sesión
          </button>
        </div>
      </nav>
      <div className="admin">
        <aside className="card side">
          <p className="eyebrow">Tu tienda</p>
          <nav aria-label="Secciones del panel">
            <a href="#importar">Importar producto</a>
            <a href="#catalogo">Catálogo</a>
            <a href="#cotizaciones">Cotizaciones</a>
            <a href="#configuracion">Configuración</a>
            <a href="#historial">Revisiones</a>
          </nav>
          <p className="muted small">
            {monitorConfigured
              ? "Programado cada 4 horas. Consulta la última revisión."
              : "Cada 4 horas, al activar el monitor en el hosting."}
          </p>
        </aside>
        <section className="admin-content" id="contenido" tabIndex={-1}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Panel de tienda</p>
              <h1>Tu catálogo, al día.</h1>
              <p className="muted">
                Productos aprobados y proveedores bajo seguimiento.
              </p>
            </div>
            <button
              className="btn ghost"
              disabled={Boolean(busy)}
              onClick={monitor}
            >
              {busy === "monitor" ? "Revisando…" : "Revisar proveedores"}
            </button>
          </div>
          <div className="grid metrics">
            <div className="card">
              <span className="muted">Productos</span>
              <div className="metric">{products.length}</div>
              <small>
                {products.filter((p) => p.status === "published").length}{" "}
                publicados
              </small>
            </div>
            <div className="card">
              <span className="muted">Fuentes por revisar</span>
              <div className="metric">
                {
                  products.filter(
                    (p) => p.sourceStatus && p.sourceStatus !== "ok",
                  ).length
                }
              </div>
              <small>Conservamos el último dato aprobado</small>
            </div>
            <div className="card">
              <span className="muted">Última revisión</span>
              <div className="metric metric-date">
                {date(runs[0]?.finishedAt)}
              </div>
              <small>Horario de Saltillo</small>
            </div>
          </div>
          {!searchState.configured && (
            <p className="notice">
              {searchState.provider === "tavily"
                ? "Tavily está seleccionado; falta guardar tu clave para buscar proveedores. "
                : "Búsqueda automática sin configurar. "}
              Puedes agregar y verificar enlaces alternativos manualmente.
            </p>
          )}
          {searchState.provider && (
            <p className="notice">
              {searchState.provider === "tavily" ? "Tavily" : "Brave"}:{" "}
              {searchState.used} de {searchState.limit} consultas de esta tienda
              en {searchState.month} (mes UTC).{" "}
              {searchState.remaining === 0
                ? "Se alcanzó el límite. La búsqueda se pausa hasta el siguiente mes; las revisiones de enlaces continúan."
                : "El límite mensual pausa nuevas búsquedas, sin detener las revisiones de enlaces."}
            </p>
          )}
          {!runs.length && (
            <p className="notice">
              {monitorConfigured
                ? "La programación está configurada; aún no hay revisiones registradas. Comprueba la primera ejecución."
                : "Todavía no hay revisiones registradas. El primer despliegue debe activar el monitor para que opere con el panel cerrado."}
            </p>
          )}
          <div
            ref={messageRef}
            role={failure ? "alert" : "status"}
            aria-live={failure ? "assertive" : "polite"}
          >
            {message && (
              <p className={failure ? "notice error" : "notice message"}>
                {message}
              </p>
            )}
          </div>
          <section className="card" id="importar">
            <h2>Importar desde un proveedor</h2>
            <p className="muted">
              Pega el enlace directo de un producto. Revisa sus datos antes de
              publicarlo.
            </p>
            <form
              className="supplier"
              onSubmit={(event) => {
                event.preventDefault();
                const url = new FormData(event.currentTarget).get("url");
                perform("import", async () => {
                  const result = await api("/api/supplier/import", { url });
                  loadDraft(result.draft);
                });
              }}
              aria-busy={busy === "import"}
            >
              <label className="field">
                Enlace del producto
                <input
                  name="url"
                  type="url"
                  required
                  maxLength={2048}
                  placeholder="https://proveedor.com/producto"
                />
              </label>
              <button className="btn" disabled={Boolean(busy)}>
                {busy === "import"
                  ? "Consultando proveedor…"
                  : "Analizar enlace"}
              </button>
            </form>
            <p className="muted small">
              Costo o entrega no publicados quedan pendientes. Algunas páginas
              necesitan una API o un adaptador del proveedor.
            </p>
          </section>
          <section className="card" aria-labelledby="pending-imports-title">
            <h2 id="pending-imports-title">Importaciones pendientes</h2>
            <p className="muted small">
              Recupera las fichas consultadas aunque cierres el panel. Los cambios
              de la vista previa se conservan al pulsar «Guardar borrador».
            </p>
            {pendingImports.length === 0 ? (
              <p className="muted">No hay fichas pendientes de revisión.</p>
            ) : (
              <ul className="pending-imports">
                {pendingImports.map(item => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="muted small">Consultado: {date(item.createdAt)} · {item.optionCount} ficha(s)</p>
                      <p className="small">
                        {item.missing.length ? `Por completar: ${item.missing.join(", ")}.` : "Datos extraídos; confirma variante y condiciones."}
                      </p>
                    </div>
                    <button type="button" className="btn ghost" disabled={Boolean(busy) || draft?.id === item.id}
                      onClick={() => {
                        if (draft && !window.confirm("¿Abrir otra ficha? Los cambios sin guardar de esta vista previa se perderán.")) return;
                        perform("resume-" + item.id, async () => {
                          const result = await api(`/api/supplier/import/${encodeURIComponent(item.id)}`, null, "GET");
                          loadDraft(result.draft);
                        });
                      }}>
                      {draft?.id === item.id ? "Ficha abierta" : busy === "resume-" + item.id ? "Abriendo…" : "Continuar revisión"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {draft && edit && (
            <section
              className="card preview"
              ref={previewRef}
              aria-labelledby="preview-title"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Paso 2 · Revisar y aprobar</p>
                  <h2 id="preview-title">Vista previa del producto</h2>
                </div>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setEdit(null);
                  }}
                >
                  Cerrar vista previa
                </button>
              </div>
              <p className="notice">
                Datos consultados el {date(draft.createdAt)}. Confirma el precio,
                la variante y la entrega antes de publicar; abrir esta ficha no vuelve a consultar al proveedor.
              </p>
              <form onSubmit={submitPreview}>
                <label className="field">
                  Ficha o variante
                  <select
                    value={selection}
                    onChange={(event) => {
                      const index = Number(event.target.value);
                      setSelection(index);
                      setEdit(
                        editFrom(
                          draft.options[index],
                          defaultMargin,
                          draft.approvedByIdentity?.[
                            draft.options[index].identityKey
                          ],
                        ),
                      );
                    }}
                  >
                    {draft.options.map((option, index) => (
                      <option key={index} value={index}>
                        {option.title || "Sin título"} ·{" "}
                        {option.variant ||
                          option.sku ||
                          "Sin variante publicada"}{" "}
                        · {money(option.supplierCost, option.currency)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="notice small">
                  {draft.options[selection].missing?.length
                    ? "La ficha tiene campos pendientes. Complétalos o guárdala como borrador."
                    : "Confirma la ficha y las condiciones del proveedor antes de publicar."}
                </p>
                <div className="editor-grid">
                  <div>
                    <label className="field">
                      Título
                      <input
                        value={edit.title}
                        onChange={change("title")}
                        required
                        maxLength={240}
                      />
                    </label>
                    <label className="field">
                      Descripción
                      <textarea
                        value={edit.description}
                        onChange={change("description")}
                        rows={5}
                        maxLength={10000}
                      />
                    </label>
                    <label className="field">
                      Imágenes · una URL por línea
                      <textarea
                        value={edit.images}
                        onChange={change("images")}
                        rows={3}
                      />
                    </label>
                    <p className="muted small">
                      Las URLs se aplicarán a las imágenes del catálogo.
                      Confirma el permiso de uso y la estabilidad de sus
                      enlaces.
                    </p>
                    <ClassificationFields
                      value={edit}
                      disabled={Boolean(busy)}
                      onChange={(fields) =>
                        setEdit((old) => ({ ...old, ...fields }))
                      }
                    />
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={edit.personalizationSupported}
                        onChange={change("personalizationSupported")}
                      />
                      Este producto se puede personalizar
                    </label>
                  </div>
                  <div>
                    <div className="grid2">
                      <label className="field">
                        Costo de proveedor
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.supplierCost}
                          onChange={change("supplierCost")}
                        />
                      </label>
                      <label className="field">
                        Moneda
                        <input
                          pattern="[A-Z]{3}"
                          maxLength={3}
                          value={edit.currency}
                          onChange={change("currency")}
                          placeholder="MXN"
                        />
                      </label>
                      <label className="field">
                        Entrega mínima · días
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={edit.deliveryMinDays}
                          onChange={change("deliveryMinDays")}
                        />
                      </label>
                      <label className="field">
                        Entrega máxima · días
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={edit.deliveryDays}
                          onChange={change("deliveryDays")}
                        />
                      </label>
                    </div>
                    <p className="muted small">
                      Sin un plazo publicado, deja entrega pendiente. El destino
                      y la cantidad pueden cambiar la estimación.
                    </p>
                    <div className="price-preview">
                      <span>Precio sugerido</span>
                      <output aria-live="polite">
                        {money(suggested, edit.currency)}
                      </output>
                      {priceNote && <small>{priceNote}</small>}
                    </div>
                    <div className="grid2">
                      {[
                        ["marginPercent", "Margen bruto · %"],
                        ["shipping", "Flete por unidad"],
                        ["otherCosts", "Otros costos"],
                        ["taxPercent", "Impuesto a agregar · %"],
                        ["feePercent", "Comisión · %"],
                        ["fixedFee", "Comisión fija"],
                        ["rounding", "Incremento de redondeo"],
                      ].map(([key, label]) => (
                        <label className="field" key={key}>
                          {label}
                          <input
                            type="number"
                            min={key === "rounding" ? "0.01" : "0"}
                            step="0.01"
                            value={edit[key]}
                            onChange={change(key)}
                          />
                        </label>
                      ))}
                      <label className="field">
                        Precio de venta manual
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={edit.publicPrice}
                          onChange={change("publicPrice")}
                          placeholder="Usar sugerido"
                        />
                      </label>
                    </div>
                    <p className="muted small">
                      No convierte divisas. Comisión sobre venta antes de
                      impuesto; evita duplicar impuestos incluidos en el costo.
                    </p>
                  </div>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={edit.conditionsConfirmed}
                    onChange={change("conditionsConfirmed")}
                  />
                  Confirmé unidad, cantidad mínima, impuestos, destino de
                  entrega y uso de imágenes.
                </label>
                <div className="actions form-actions">
                  <button
                    className="btn"
                    name="status"
                    value="published"
                    disabled={Boolean(busy)}
                  >
                    {busy === "apply" ? "Guardando…" : "Aprobar y publicar"}
                  </button>
                  <button
                    className="btn ghost"
                    name="status"
                    value="draft"
                    disabled={Boolean(busy)}
                  >
                    Guardar borrador
                  </button>
                </div>
                <details>
                  <summary>Datos originales y evidencia</summary>
                  <pre>
                    {JSON.stringify(draft.options[selection].evidence, null, 2)}
                  </pre>
                </details>
              </form>
            </section>
          )}
          <section id="catalogo">
            <div className="section-heading">
              <h2>Catálogo y proveedores</h2>
              <button
                className="btn ghost"
                disabled={Boolean(busy)}
                onClick={() => perform("refresh", refresh)}
              >
                Actualizar
              </button>
            </div>
            {!products.length && (
              <div className="card empty">
                <h3>Tu primer producto empieza con un enlace</h3>
                <p className="muted">
                  Importa una ficha para ver aquí su precio, entrega y estado de
                  revisión.
                </p>
              </div>
            )}
            {products.map((product) => (
              <article className="card product-admin" key={product.id}>
                <div className="section-heading">
                  <div>
                    <h3>{product.title}</h3>
                    <p className="muted">{classificationLabel(product)}</p>
                  </div>
                  <span
                    className={
                      "badge " + (product.status === "published" ? "good" : "")
                    }
                  >
                    {product.status === "published" ? "Publicado" : "Borrador"}
                  </span>
                </div>
                <ProductClassificationEditor
                  product={product}
                  busy={Boolean(busy)}
                  onSave={(fields) =>
                    perform("classify-" + product.id, async () => {
                      await api(
                        `/api/products/${product.id}/classification`,
                        fields,
                        "PATCH",
                      );
                      await refresh();
                      notify("Categoría y subcategoría actualizadas.");
                    })
                  }
                />
                <dl className="product-facts">
                  <div>
                    <dt>Costo de proveedor</dt>
                    <dd>{money(product.supplierCost, product.currency)}</dd>
                  </div>
                  <div>
                    <dt>Precio sugerido</dt>
                    <dd>{money(product.suggestedPrice, product.currency)}</dd>
                  </div>
                  <div>
                    <dt>Precio de venta</dt>
                    <dd>{money(product.publicPrice, product.currency)}</dd>
                  </div>
                  <div>
                    <dt>Entrega publicada</dt>
                    <dd>
                      {product.deliveryDays === null
                        ? "Pendiente"
                        : `${product.deliveryMinDays ?? product.deliveryDays}–${product.deliveryDays} días`}
                    </dd>
                  </div>
                </dl>
                <div className="source-line">
                  <span
                    className={
                      "badge " + (product.sourceStatus === "ok" ? "good" : "")
                    }
                  >
                    {statusNames[product.sourceStatus] || "Pendiente"}
                  </span>
                  <a
                    href={product.supplierUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    Abrir proveedor
                  </a>
                </div>
                <p className="muted small">
                  Última revisión: {date(product.lastCheckedAt)} · Próxima
                  prevista: {date(product.nextCheckAt)}
                </p>
                {product.sourceObservation && product.sourceStatus !== "ok" && (
                  <p className="notice">
                    Costo observado:{" "}
                    {money(
                      product.sourceObservation.supplierCost,
                      product.sourceObservation.currency,
                    )}
                    . Revisa el enlace para aprobar los nuevos datos.
                  </p>
                )}
                {product.sourceMessage && (
                  <p className="notice">{product.sourceMessage}</p>
                )}
                <div className="actions">
                  <button
                    className="btn ghost"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      perform("reimport", async () => {
                        const result = await api("/api/supplier/import", {
                          url: product.supplierUrl,
                        });
                        loadDraft(result.draft);
                      })
                    }
                  >
                    Revisar ficha
                  </button>
                  <button
                    className="btn ghost"
                    disabled={Boolean(busy)}
                    onClick={() => history(product.id)}
                  >
                    Historial y alternativas
                  </button>
                  {product.status === "published" && (
                    <button
                      className="btn ghost"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        perform("unpublish", async () => {
                          await api("/api/products", {
                            id: product.id,
                            status: "draft",
                          });
                          await refresh();
                          notify("Producto retirado del catálogo público.");
                        })
                      }
                    >
                      Retirar del catálogo
                    </button>
                  )}
                </div>
                {intelligence[product.id] && (
                  <div className="intelligence">
                    <h4>Alternativas de proveedor</h4>
                    {intelligence[product.id].alternatives.map(
                      (alternative) => (
                        <div className="alternative" key={alternative.id}>
                          <p>
                            <a
                              className="text-link"
                              href={alternative.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {alternative.observed?.title ||
                                "Enlace alternativo"}
                            </a>
                            <br />
                            <small>
                              {money(
                                alternative.observed?.supplierCost,
                                alternative.observed?.currency,
                              )}{" "}
                              ·{" "}
                              {alternative.matchStatus === "verified"
                                ? "Identidad verificada"
                                : "Candidata por verificar"}{" "}
                              ·{" "}
                              {statusNames[alternative.sourceStatus] ||
                                alternative.sourceStatus}
                            </small>
                          </p>
                          <p className="muted small">
                            {alternative.comparison}
                          </p>
                          {alternative.matchStatus !== "verified" && (
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  reviewedCandidates[alternative.id],
                                )}
                                onChange={(event) =>
                                  setReviewedCandidates((old) => ({
                                    ...old,
                                    [alternative.id]: event.target.checked,
                                  }))
                                }
                              />
                              Confirmé que la ficha corresponde al mismo
                              artículo, variante y unidad.
                            </label>
                          )}
                          {(alternative.matchStatus === "verified" ||
                            reviewedCandidates[alternative.id]) &&
                            ["ok", "changed"].includes(
                              alternative.sourceStatus,
                            ) && (
                              <button
                                className="btn ghost"
                                disabled={Boolean(busy)}
                                onClick={() =>
                                  perform("select-alternative", async () => {
                                    const result = await api(
                                      `/api/supplier/alternatives/${alternative.id}/select`,
                                      {
                                        productId: product.id,
                                        identityConfirmed: Boolean(
                                          reviewedCandidates[alternative.id],
                                        ),
                                      },
                                    );
                                    loadDraft(result.draft);
                                    notify(
                                      "Revisa las condiciones de la alternativa. El proveedor se cambiará al aprobar esta vista previa.",
                                    );
                                  })
                                }
                              >
                                Revisar para sustituir
                              </button>
                            )}
                        </div>
                      ),
                    )}
                    {!intelligence[product.id].alternatives.length && (
                      <p className="muted">
                        Todavía no hay alternativas guardadas.
                      </p>
                    )}
                    <form
                      className="supplier"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const url = new FormData(event.currentTarget).get(
                          "url",
                        );
                        perform("alternative", async () => {
                          await api("/api/supplier/alternatives", {
                            productId: product.id,
                            url,
                          });
                          const data = await api(
                            `/api/products/${product.id}/supplier-intelligence`,
                            null,
                            "GET",
                          );
                          setIntelligence((old) => ({
                            ...old,
                            [product.id]: data,
                          }));
                          notify(
                            "Alternativa consultada. Revisa su identidad y condiciones.",
                          );
                        });
                      }}
                    >
                      <label className="field">
                        Enlace alternativo
                        <input
                          name="url"
                          type="url"
                          required
                          placeholder="https://otro-proveedor.com/producto"
                        />
                      </label>
                      <button className="btn ghost" disabled={Boolean(busy)}>
                        Verificar alternativa
                      </button>
                    </form>
                    <details>
                      <summary>Historial de la fuente</summary>
                      {intelligence[product.id].checks
                        .slice()
                        .reverse()
                        .slice(0, 20)
                        .map((check) => (
                          <p key={check.id} className="muted small">
                            {date(check.checkedAt)} ·{" "}
                            {statusNames[check.status] || check.status} ·{" "}
                            {money(
                              check.observedPrice,
                              check.observed?.currency,
                            )}
                          </p>
                        ))}
                    </details>
                  </div>
                )}
              </article>
            ))}
          </section>
          <QuoteInbox />
          <ContactSettings initialSettings={initialContactSettings} />
          <section className="card" id="historial">
            <h2>Revisiones del catálogo</h2>
            <p className="muted small">
              Horario de Saltillo (Ciudad de México).{" "}
              {monitorConfigured
                ? "Revisiones programadas cada 4 horas; el historial confirma las ejecuciones completadas."
                : "La programación se activa durante el despliegue."}
            </p>
            {runs.slice(0, 10).map((run) => (
              <div className="run" key={run.id}>
                <strong>{date(run.startedAt)}</strong>
                <span>
                  {run.status === "completed"
                    ? "Completada"
                    : run.status === "running"
                      ? "En curso"
                      : "Fallida"}{" "}
                  · {run.checked} enlaces · {run.issues.length} incidencias ·{" "}
                  {run.added} alternativas
                </span>
                {run.search.some(
                  (result) => result.status === "unconfigured",
                ) && <small>Búsqueda automática sin configurar</small>}
                {[...new Set(run.search.map((result) => result.status))]
                  .filter(
                    (status) => status !== "ok" && status !== "unconfigured",
                  )
                  .map((status) => (
                    <small key={status}>
                      {{
                        scheduled:
                          "La búsqueda completa se realiza desde el monitor programado.",
                        budget_exhausted:
                          "Búsqueda pausada: límite mensual de la tienda alcanzado.",
                        quota_exhausted:
                          "El buscador reportó su cuota agotada.",
                        invalid_key:
                          "El buscador rechazó la clave; revisa su configuración.",
                        rate_limited:
                          "El buscador limitó temporalmente las consultas.",
                        unavailable:
                          "La búsqueda no estuvo disponible; los enlaces guardados se siguen revisando.",
                      }[status] || "Consulta de proveedores pendiente."}
                    </small>
                  ))}
              </div>
            ))}
            {!runs.length && (
              <p className="muted">Sin ejecuciones registradas.</p>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
