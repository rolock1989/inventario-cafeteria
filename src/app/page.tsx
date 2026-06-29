"use client";

import { Coffee } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getUsers } from "@/lib/inventory";

export default function LoginPage() {
  const router = useRouter();
  const users = getUsers();
  const [selectedUserId, setSelectedUserId] = useState(users[0].id);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            <select onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}>
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
            <input defaultValue="inventario123" type="password" />
          </label>
          <button className="btn" type="submit">
            Entrar al panel
          </button>
        </form>

        <div className="helper-box" style={{ marginTop: 18 }}>
          <strong>Usuarios demo:</strong>
          <br />
          Admin: admin@inventariocafe.cl
          <br />
          Trabajador: trabajador@inventariocafe.cl
        </div>
      </section>
    </main>
  );
}
