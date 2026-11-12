// Cliente de Stripe perezoso: no se construye hasta la primera llamada que
// lo necesita, y nunca guarda claves en archivos. La clave vive solo en la
// variable de entorno STRIPE_SECRET_KEY (Render). En pruebas se inyecta un
// cliente falso a lib/checkout-service.mjs; este módulo no se toca.
import Stripe from "stripe";
import { ApiError } from "./admin-auth.mjs";

const key = Symbol.for("souvenirs.stripe.client");
export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new ApiError(
      "El pago con tarjeta aún no está configurado en el servidor.",
      503,
    );
  globalThis[key] ||= new Stripe(process.env.STRIPE_SECRET_KEY);
  return globalThis[key];
}
