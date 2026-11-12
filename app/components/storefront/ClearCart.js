"use client";
import { useEffect } from "react";
import { CART_STORAGE_KEY } from "../../../packages/core/cart.mjs";
// Tras un pago confirmado, el carrito ya cumplió su función: se vacía para
// que el cliente no vuelva a comprar los mismos artículos por accidente.
// Si el pago se cancela, el carrito se conserva (ver /checkout/cancel).
export default function ClearCart() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Sin almacenamiento disponible, no hay nada que vaciar.
    }
  }, []);
  return null;
}
