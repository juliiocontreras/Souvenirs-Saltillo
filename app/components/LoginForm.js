"use client";
import { useState } from "react";
export default function LoginForm() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: new FormData(event.currentTarget).get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign("/admin");
    } catch (error) {
      setError(error.message || "No fue posible iniciar sesión.");
      setBusy(false);
    }
  }
  return (
    <form method="post" onSubmit={submit} aria-busy={busy}>
      <label className="field">
        Contraseña
        <input
          name="password"
          type="password"
          required
          maxLength={1024}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button className="btn full" disabled={busy}>
        {busy ? "Ingresando…" : "Entrar al panel"}
      </button>
    </form>
  );
}
