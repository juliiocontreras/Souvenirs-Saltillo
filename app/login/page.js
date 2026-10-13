import LoginForm from "../components/LoginForm";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="/">
          Souvenirs Saltillo
        </a>
        <a className="text-link" href="/">
          Volver a la tienda
        </a>
      </nav>
      <section className="card login" id="contenido" tabIndex={-1}>
        <p className="eyebrow">Administración</p>
        <h1>Tu tienda, al día.</h1>
        <p className="muted">
          Accede para organizar el catálogo y revisar tus proveedores.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
