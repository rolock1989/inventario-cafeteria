"use client";

import { Coffee } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { signInWithEmail, getAuthSession } from "@/lib/auth";
import { loadCurrentUser } from "@/lib/repositories";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Ingresa con tu email y contrasena.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function redirectIfSessionExists() {
      try {
        const session = await getAuthSession();

        if (session) {
          await loadCurrentUser();
          router.replace("/dashboard");
        }
      } catch (error) {
        console.error("No se pudo recuperar la sesion", error);
      }
    }

    redirectIfSessionExists();
  }, [router]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setMessage("Ingresa email y contrasena.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmail(email.trim(), password);
      const user = await loadCurrentUser();
      router.push(user.role === "admin" ? "/dashboard" : "/dashboard/inventario");
    } catch (error) {
      console.error("Error al iniciar sesion", error);
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand" style={{ color: "var(--coffee-dark)", marginBottom: 24 }}>
          <span className="brand-mark">
            <Coffee size={24} />
          </span>
          Inventario Cafe
        </div>

        <p className="eyebrow">Acceso interno</p>
        <h1>Control semanal de stock</h1>
        <p className="muted">Ingresa con tu email y contrasena de Supabase Auth.</p>

        <form className="grid" onSubmit={signIn} style={{ marginTop: 24 }}>
          <label className="field">
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            Contrasena
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button className="btn" disabled={loading} type="submit">
            Entrar al panel
          </button>
        </form>

        <div className="helper-box" style={{ marginTop: 18 }}>
          {message}
        </div>
      </section>
    </main>
  );
}
