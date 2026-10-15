import "./globals.css";
export const metadata = {
  title: "Souvenirs Saltillo",
  description:
    "Regalos, detalles personalizados y recuerdos para tus momentos especiales. Explora el catálogo de Souvenirs Saltillo, en Saltillo, Coahuila.",
  icons: { icon: "/images/brand-mark.png" },
  robots: { index: true, follow: true },
};
export default function Layout({ children }) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
