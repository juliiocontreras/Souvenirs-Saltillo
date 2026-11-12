import Link from "next/link";
import "../../storefront-fonts.css";
import "../../storefront.css";
export default function CheckoutCancel() {
  return (
    <div className="storefront">
      <main
        className="sf-container sf-checkout-result"
        id="contenido"
        tabIndex={-1}
      >
        <p className="sf-eyebrow">Souvenirs Saltillo</p>
        <h1>Tu pago quedó en pausa</h1>
        <p>
          No se realizó ningún cargo. Tu carrito sigue guardado en este
          navegador y puedes intentarlo de nuevo cuando quieras.
        </p>
        <div className="sf-checkout-actions">
          <Link className="sf-button" href="/#catalogo">
            Volver al catálogo
          </Link>
        </div>
      </main>
    </div>
  );
}
