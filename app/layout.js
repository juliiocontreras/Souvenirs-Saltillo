import "./globals.css";
export const metadata = {
  title: "Souvenirs Saltillo",
  description: "Souvenirs y artículos personalizados en Saltillo",
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
