"use client";
import { useState } from "react";
import ClassificationFields from "./ClassificationFields";
import { STOCK_STATUS_LABELS } from "../../packages/core/manual-products.mjs";

function emptyForm(initial) {
  return {
    title: initial?.title || "",
    description: initial?.description || "",
    category: initial?.category || "Souvenirs de Saltillo",
    subcategory: initial?.subcategory || "",
    publicPrice: initial?.publicPrice ?? "",
    deliveryMinDays: initial?.deliveryMinDays ?? "",
    deliveryDays: initial?.deliveryDays ?? "",
    personalizationSupported: initial?.personalizationSupported || false,
    stockStatus: initial?.stockStatus || "unknown",
  };
}

export default function ManualProductForm({
  initial = null,
  api,
  onSaved,
  onCancel,
}) {
  const [form, setForm] = useState(() => emptyForm(initial));
  const [images, setImages] = useState(initial?.images || []);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = saving || uploading;
  const change = (key) => (event) =>
    setForm((old) => ({
      ...old,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  async function uploadFiles(fileList) {
    const files = [...fileList].filter(Boolean);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const data = new FormData();
      for (const file of files) data.append("images", file);
      const response = await fetch("/api/product-images", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudieron subir las fotos.");
      setImages((old) => [
        ...old,
        ...result.images.map((image) => image.url),
      ]);
    } catch (error) {
      setError(error.message);
    } finally {
      setUploading(false);
    }
  }
  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https:\/\//.test(url)) {
      setError("La URL de la foto debe empezar con https://");
      return;
    }
    if (images.includes(url)) {
      setError("Esa foto ya está en la lista.");
      return;
    }
    setImages((old) => [...old, url]);
    setUrlInput("");
    setError("");
  }
  async function submit(event) {
    event.preventDefault();
    const submitStatus = event.nativeEvent.submitter?.value || "draft";
    if (!form.title.trim()) {
      setError("Agrega un título.");
      return;
    }
    const price = Number(form.publicPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Agrega un precio de venta en MXN mayor que cero.");
      return;
    }
    if (submitStatus === "published" && images.length === 0) {
      setError("Agrega al menos una foto para publicar el producto.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        subcategory: form.subcategory,
        publicPrice: price,
        deliveryDays:
          form.deliveryDays === "" ? null : Number(form.deliveryDays),
        deliveryMinDays:
          form.deliveryMinDays === "" ? null : Number(form.deliveryMinDays),
        images,
        personalizationSupported: form.personalizationSupported,
        stockStatus: form.stockStatus,
        status: submitStatus,
      };
      const result = initial
        ? await api(`/api/products/${initial.id}`, body, "PATCH")
        : await api("/api/products", body);
      onSaved(result.product, submitStatus);
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-grid">
        <div>
          <label className="field">
            Título
            <input
              value={form.title}
              onChange={change("title")}
              required
              maxLength={240}
              placeholder="Taza de cerámica de Saltillo"
            />
          </label>
          <label className="field">
            Descripción
            <textarea
              value={form.description}
              onChange={change("description")}
              rows={5}
              maxLength={10000}
              placeholder="Material, medidas y lo que incluye el souvenir."
            />
          </label>
          <ClassificationFields
            value={form}
            disabled={busy}
            onChange={(fields) =>
              setForm((old) => ({ ...old, ...fields }))
            }
          />
          <label className="check">
            <input
              type="checkbox"
              checked={form.personalizationSupported}
              onChange={change("personalizationSupported")}
            />
            Este producto se puede personalizar
          </label>
        </div>
        <div>
          <div className="grid2">
            <label className="field">
              Precio de venta · MXN
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.publicPrice}
                onChange={change("publicPrice")}
                placeholder="299"
              />
            </label>
            <label className="field">
              Disponibilidad
              <select
                value={form.stockStatus}
                onChange={change("stockStatus")}
                disabled={busy}
              >
                {Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Entrega mínima · días
              <input
                type="number"
                min="0"
                max="365"
                value={form.deliveryMinDays}
                onChange={change("deliveryMinDays")}
              />
            </label>
            <label className="field">
              Entrega máxima · días
              <input
                type="number"
                min="0"
                max="365"
                value={form.deliveryDays}
                onChange={change("deliveryDays")}
              />
            </label>
          </div>
          <p className="muted small">
            El precio ya incluye IVA y siempre es en pesos mexicanos.
          </p>
        </div>
      </div>
      <div className="field">
        Fotos del producto
        {images.length > 0 && (
          <ul className="manual-images">
            {images.map((url) => (
              <li key={url}>
                <img src={url} alt="" />
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() =>
                    setImages((old) => old.filter((item) => item !== url))
                  }
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="supplier">
          <label className="field">
            Foto por URL · https
            <input
              type="url"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="https://…/foto.jpg"
            />
          </label>
          <button
            type="button"
            className="btn ghost"
            disabled={busy || !urlInput.trim()}
            onClick={addUrl}
          >
            Agregar URL
          </button>
        </div>
        <label className="field">
          O sube fotos desde tu dispositivo · PNG, JPG o WebP, hasta 2 MB
          cada una
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={busy}
            onChange={(event) => {
              uploadFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {uploading && <p className="muted small">Subiendo fotos…</p>}
        <p className="muted small">
          Para publicar se necesita al menos una foto. Las fotos subidas se
          guardan en la base de datos de la tienda.
        </p>
      </div>
      <div className="actions form-actions">
        <button
          className="btn"
          name="status"
          value="published"
          disabled={busy}
        >
          {saving ? "Guardando…" : initial ? "Guardar y publicar" : "Publicar"}
        </button>
        <button
          className="btn ghost"
          name="status"
          value="draft"
          disabled={busy}
        >
          Guardar como borrador
        </button>
        {initial && (
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar edición
          </button>
        )}
      </div>
    </form>
  );
}
