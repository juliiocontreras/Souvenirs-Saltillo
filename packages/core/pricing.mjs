function amount(value, name) {
  if (
    !["number", "string"].includes(typeof value) ||
    (typeof value === "string" && (!value.trim() || value.length > 64))
  )
    throw new Error(`Falta ${name} o no es válido`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e12)
    throw new Error(`${name} inválido`);
  return n;
}
export function calculatePricing({
  cost,
  marginPercent,
  shipping = 0,
  otherCosts = 0,
  feePercent = 0,
  fixedFee = 0,
  taxPercent = 0,
  rounding = 1,
}) {
  const c = amount(cost, "costo"),
    m = amount(marginPercent, "margen"),
    ship = amount(shipping, "flete"),
    other = amount(otherCosts, "otros costos"),
    fee = amount(feePercent, "comisión"),
    fixed = amount(fixedFee, "comisión fija"),
    tax = amount(taxPercent, "impuesto"),
    step = amount(rounding, "redondeo");
  if (m + fee >= 100 || step <= 0 || step < 0.01)
    throw new Error(
      "Margen más comisión debe ser menor al 100% y el redondeo al menos 0.01.",
    );
  const costTotal = c + ship + other,
    raw = ((costTotal + fixed) / (1 - (m + fee) / 100)) * (1 + tax / 100);
  if (!Number.isFinite(raw) || raw > 1e12)
    throw new Error("Precio fuera del rango admitido.");
  const suggestedPrice = Number(
    (Math.ceil(raw / step - 1e-10) * step).toFixed(2),
  );
  return { costTotal, suggestedPrice };
}
export function suggestPrice(cost, marginPercent = 40) {
  return calculatePricing({ cost, marginPercent }).suggestedPrice;
}
