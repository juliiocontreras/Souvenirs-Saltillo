"use client";
import { useEffect, useState } from "react";
import ClassificationFields from "./ClassificationFields";

export default function ProductClassificationEditor({ product, busy, onSave }) {
  const [value, setValue] = useState({
    category: product.category || "Regalos",
    subcategory: product.subcategory || "",
  });
  useEffect(() => {
    setValue({
      category: product.category || "Regalos",
      subcategory: product.subcategory || "",
    });
  }, [product.id, product.category, product.subcategory]);
  const unchanged =
    value.category === (product.category || "Regalos") &&
    value.subcategory === (product.subcategory || "");
  return (
    <details className="classification-editor">
      <summary>Editar categoría</summary>
      <form
        aria-label={"Clasificar " + product.title}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(value);
        }}
      >
        <ClassificationFields
          value={value}
          disabled={busy}
          onChange={(fields) => setValue((old) => ({ ...old, ...fields }))}
        />
        <button
          className="btn ghost"
          type="submit"
          disabled={busy || unchanged}
        >
          Guardar clasificación
        </button>
      </form>
    </details>
  );
}
