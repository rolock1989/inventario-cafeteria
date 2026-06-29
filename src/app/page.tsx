"use client";

import { Coffee } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { listUsers } from "@/lib/repositories";
import { AppUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [message, setMessage] = useState("Cargando usuarios...");

  useEffect(() => {
    async function loadLoginUsers() {
      try {
        const activeUsers = await listUsers({ activeOnly: true });
        setUsers(activeUsers);
        setSelectedUserId(activeUsers[0]?.id ?? "");
        setMessage(activeUsers.length > 0 ? "Selecciona tu usuario." : "No hay usuarios activos.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
      }
    }

    loadLoginUsers();
  }, []);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) {
      setMessage("Selecciona un usuario activo para ingresar.");
      return;
    }

    window.localStorage.setItem("inventario-cafe-user-id", selectedUserId);
    router.push("/dashboard");
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
        <p className="muted">
          Ingresa con un usuario de prueba para revisar el flujo de trabajadores y administradores.
        </p>

        <form className="grid" onSubmit={signIn} style={{ marginTop: 24 }}>
          <label className="field">
            Usuario demo
            <select disabled={users.length === 0} onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.role}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Email
            <input
              readOnly
              type="email"
              value={users.find((user) => user.id === selectedUserId)?.email ?? ""}
            />
          </label>
          <label className="field">
            Contrasena
            <input disabled placeholder="Supabase Auth pendiente" type="password" />
          </label>
          <button className="btn" disabled={users.length === 0} type="submit">
            Entrar al panel
          </button>
        </form>

        <div className="helper-box" style={{ marginTop: 18 }}>
          <strong>Usuarios demo:</strong>
          <br />
          {message}
          <br />
          Admin inicial: admin@inventariocafe.cl
          <br />
          Trabajador inicial: trabajador@inventariocafe.cl
        </div>
      </section>
    </main>
  );
}
