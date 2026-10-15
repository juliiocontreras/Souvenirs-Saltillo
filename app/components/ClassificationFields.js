import {
  PRODUCT_CATEGORY_NAMES,
  LEGACY_CATEGORIES,
  subcategoriesFor,
} from "../../packages/core/categories.mjs";

export default function ClassificationFields({
  value,
  onChange,
  disabled = false,
}) {
  const subcategories = subcategoriesFor(value.category);
  return (
    <div className="grid2">
      <label className="field">
        Categoría
        <select
          aria-label="Categoría"
          value={value.category}
          disabled={disabled}
          onChange={(event) =>
            onChange({ category: event.target.value, subcategory: "" })
          }
        >
          <optgroup label="Categorías del catálogo">
            {PRODUCT_CATEGORY_NAMES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </optgroup>
          <optgroup label="Clasificaciones anteriores">
            {LEGACY_CATEGORIES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </optgroup>
        </select>
      </label>
      {subcategories.length > 0 && (
        <label className="field">
          Subcategoría
          <select
            aria-label="Subcategoría"
            value={value.subcategory || ""}
            disabled={disabled}
            onChange={(event) => onChange({ subcategory: event.target.value })}
          >
            <option value="">Sin subcategoría</option>
            {subcategories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
