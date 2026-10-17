import {
  PRODUCT_CATEGORY_NAMES,
  subcategoriesFor,
  classificationLabel,
} from "../../../packages/core/categories.mjs";
import { mexicoToday } from "../../../packages/core/quotes.mjs";

export function ContactFields({ value, change }) {
  return (
    <>
      <h3>Primero, ¿cómo podemos contactarte?</h3>
      <p>Te acompañaré para reunir los detalles de tu pedido.</p>
      <label>
        Nombre
        <input
          name="name"
          autoComplete="name"
          value={value.name}
          onChange={change}
          required
          maxLength={120}
        />
      </label>
      <label>
        Empresa (opcional)
        <input
          name="company"
          autoComplete="organization"
          value={value.company}
          onChange={change}
          maxLength={160}
        />
      </label>
      <label>
        Contacto preferido
        <select
          name="preferredContact"
          aria-label="Contacto preferido"
          value={value.preferredContact}
          onChange={change}
        >
          {["WhatsApp", "Correo", "Teléfono"].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        {value.preferredContact === "Correo"
          ? "Teléfono (opcional)"
          : "Teléfono con lada"}
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+52 844 123 4567"
          value={value.phone}
          onChange={change}
          required={value.preferredContact !== "Correo"}
          maxLength={40}
        />
      </label>
      <label>
        {value.preferredContact === "Correo" ? "Correo" : "Correo (opcional)"}
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={value.email}
          onChange={change}
          required={value.preferredContact === "Correo"}
          maxLength={180}
        />
      </label>
    </>
  );
}

export function OrderFields({ value, change }) {
  return (
    <>
      <h3>Cuéntame qué tienes en mente.</h3>
      <p>
        Un artículo, un evento o una idea. Podemos empezar con lo que ya sabes.
      </p>
      <label>
        Categoría
        <select
          name="category"
          aria-label="Categoría"
          value={value.category}
          onChange={change}
        >
          <option value="">Aún no lo decido</option>
          {PRODUCT_CATEGORY_NAMES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      {subcategoriesFor(value.category).length > 0 && (
        <label>
          Tipo de artículo
          <select
            name="subcategory"
            aria-label="Tipo de artículo"
            value={value.subcategory}
            onChange={change}
          >
            <option value="">Por definir</option>
            {subcategoriesFor(value.category).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Cantidad de piezas
        <input
          name="quantity"
          type="number"
          inputMode="numeric"
          min="1"
          max="100000"
          step="1"
          value={value.quantity}
          onChange={change}
          required
        />
      </label>
      <label>
        <span id="quote-description-label">Características del pedido</span>
        <textarea
          name="description"
          aria-labelledby="quote-description-label"
          rows={4}
          placeholder="Artículo, colores, materiales, personalización y para qué ocasión lo necesitas…"
          value={value.description}
          onChange={change}
          maxLength={2000}
          required
        />
      </label>
      <label>
        Presupuesto (opcional)
        <input
          name="budget"
          placeholder="Por pieza o total, con moneda"
          value={value.budget}
          onChange={change}
          maxLength={160}
        />
      </label>
    </>
  );
}

export function DeliveryFields({ value, change, logo, onLogo }) {
  return (
    <>
      <h3>Hagámoslo tuyo, a tiempo.</h3>
      <p>
        Estos datos nos ayudan a revisar personalización y entrega. La fecha se
        confirma al cotizar.
      </p>
      <label>
        Logo o diseño
        <select
          name="logoStatus"
          aria-label="Logo o diseño"
          value={value.logoStatus}
          onChange={change}
          required
        >
          <option value="">Selecciona una opción</option>
          {[
            "Tengo un logo",
            "Necesito ayuda con el diseño",
            "Sin logo",
            "Por definir",
          ].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      {value.logoStatus === "Tengo un logo" && (
        <label>
          Adjuntar logo (opcional)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={onLogo}
          />
          <small>
            {logo
              ? logo.name
              : "PNG, JPG, WebP o PDF. Hasta 1 MB; también puedes enviarlo después."}
          </small>
        </label>
      )}
      <label>
        Fecha deseada de entrega
        <input
          name="deliveryDate"
          type="date"
          value={value.deliveryDate}
          onChange={change}
          min={mexicoToday()}
          required={!value.deliveryFlexible}
          disabled={value.deliveryFlexible}
        />
      </label>
      <label className="sf-quote-check">
        <input
          type="checkbox"
          name="deliveryFlexible"
          checked={value.deliveryFlexible}
          onChange={change}
        />
        La fecha está por definir
      </label>
      <label>
        Ciudad y estado de entrega
        <input
          name="location"
          autoComplete="address-level2"
          placeholder="Por ejemplo: Saltillo, Coahuila"
          value={value.location}
          onChange={change}
          maxLength={180}
          required
        />
      </label>
      <label>
        Nivel de urgencia
        <select
          name="urgency"
          aria-label="Nivel de urgencia"
          value={value.urgency}
          onChange={change}
          required
        >
          <option value="">Selecciona una opción</option>
          {["Normal", "Urgente", "Lo antes posible"].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        ¿Necesitas factura?
        <select
          name="invoice"
          aria-label="¿Necesitas factura?"
          value={value.invoice}
          onChange={change}
          required
        >
          <option value="">Selecciona una opción</option>
          {["Sí", "No", "Por definir"].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
    </>
  );
}

export function ReviewFields({ value, change, logo }) {
  const details = [
    [
      "Contacto",
      [
        value.name,
        value.company,
        value.preferredContact,
        value.phone,
        value.email,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      "Pedido",
      `${classificationLabel({ category: value.category || "Por definir", subcategory: value.subcategory })} · ${value.quantity} piezas`,
    ],
    ["Características", value.description],
    ["Presupuesto", value.budget || "Por definir"],
    ["Diseño", value.logoStatus + (logo ? " · " + logo.name : "")],
    [
      "Entrega",
      (value.deliveryDate || "Fecha por definir") + " · " + value.location,
    ],
    ["Urgencia", value.urgency],
    ["Factura", value.invoice],
  ];
  return (
    <>
      <h3>Revisemos tu solicitud.</h3>
      <p>
        Al enviarla recibirás un folio. Nuestro equipo revisará opciones, precio
        y viabilidad de entrega.
      </p>
      <dl className="sf-quote-summary">
        {details.map(([label, detail]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
      <label className="sf-quote-check">
        <input
          type="checkbox"
          name="consent"
          checked={value.consent}
          onChange={change}
          required
        />
        Autorizo a Souvenirs Saltillo a usar estos datos y el archivo adjunto
        para atender mi cotización y contactarme por el medio elegido.
      </label>
      <p className="sf-quote-note">
        Esta solicitud no es una compra. Precio, disponibilidad, diseño y fecha
        se confirman al cotizar. Tus datos no se publican en la tienda.
      </p>
    </>
  );
}
