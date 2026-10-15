"use client";

import { useState } from "react";
import { whatsappContactUrl } from "../../packages/core/contact.mjs";

export default function ContactSettings({ initialSettings }) {
  const [saved, setSaved] = useState(initialSettings);
  const [number, setNumber] = useState(initialSettings.whatsappNumber);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);
  const contactUrl = whatsappContactUrl(saved.whatsappNumber);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFailure(false);
    try {
      const response = await fetch("/api/settings/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber: number }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el contacto.");
      setSaved(data.settings);
      setNumber(data.settings.whatsappNumber);
      setMessage(
        data.settings.whatsappNumber
          ? "Número guardado. El contacto por WhatsApp está disponible al abrir o recargar la tienda."
          : "Enlace de WhatsApp desactivado. La tienda conserva el asistente de solicitudes.",
      );
    } catch (error) {
      setFailure(true);
      setMessage(error.message || "No se pudo guardar el contacto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" id="configuracion" aria-labelledby="contact-settings-title">
      <p className="eyebrow">Configuración</p>
      <h2 id="contact-settings-title">WhatsApp del negocio</h2>
      <p className="muted">
        Recibe consultas de las categorías del catálogo en el WhatsApp de Souvenirs Saltillo.
      </p>
      <p className="small">
        {contactUrl ? "Estado: contacto directo configurado." : "Estado: pendiente de configurar."}
      </p>
      <form onSubmit={save}>
        <label className="field">
          Número de WhatsApp del negocio
          <input
            type="tel"
            autoComplete="tel"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            maxLength={64}
            aria-describedby="whatsapp-help"
            disabled={busy}
          />
        </label>
        <p id="whatsapp-help" className="muted small">
          Incluye el código de país. Para México: +52 y los 10 dígitos del número.
          Deja el campo vacío y guarda para desactivar el enlace directo.
        </p>
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar contacto"}
          </button>
          {contactUrl && (
            <a className="btn" href={contactUrl} target="_blank" rel="noopener noreferrer">
              Probar WhatsApp guardado
            </a>
          )}
        </div>
        <p className="muted small">
          Verifica que el enlace abra la cuenta correcta. El número será público en la tienda.
        </p>
        {message && (
          <p className={`notice${failure ? " error" : ""}`} role={failure ? "alert" : "status"}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
