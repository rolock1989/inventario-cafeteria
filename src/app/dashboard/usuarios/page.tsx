"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createUser, deleteUserRecord, listUsers, updateUserRecord } from "@/lib/repositories";
import { AppUser, UserRole } from "@/lib/types";
import { useEffect, useState } from "react";

type UserForm = Omit<AppUser, "id" | "shift"> & {
  password: string;
};

type PasswordDrafts = Record<string, string>;

const emptyUser: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "trabajador",
  active: true
};

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState(emptyUser);
  const [passwordDrafts, setPasswordDrafts] = useState<PasswordDrafts>({});
  const [message, setMessage] = useState("Cargando usuarios...");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setUsers(await listUsers());
      setMessage("Usuarios cargados.");
    } catch (error) {
      console.error("Error al cargar usuarios", error);
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser() {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setMessage("Completa nombre, email y contrasena.");
      return;
    }

    try {
      const createdUser = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        active: form.active
      });
      setUsers((current) => [...current, createdUser].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setForm(emptyUser);
      setMessage("Usuario creado correctamente.");
    } catch (error) {
      console.error("Error al crear usuario", error);
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el usuario.");
    }
  }

  function updateUser(id: string, patch: Partial<AppUser>) {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  }

  async function saveUser(user: AppUser) {
    try {
      setSavingId(user.id);
      const savedUser = await updateUserRecord(user.id, {
        name: user.name.trim(),
        email: user.email.trim(),
        role: user.role,
        active: user.active,
        password: passwordDrafts[user.id]?.trim() || undefined
      });
      setUsers((current) => current.map((currentUser) => (currentUser.id === user.id ? savedUser : currentUser)));
      setPasswordDrafts((current) => ({ ...current, [user.id]: "" }));
      setMessage("Usuario guardado correctamente.");
    } catch (error) {
      console.error("Error al guardar usuario", error);
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el usuario.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(user: AppUser) {
    const confirmed = window.confirm(`Eliminar el usuario "${user.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteUserRecord(user.id);
      setUsers((current) => current.filter((currentUser) => currentUser.id !== user.id));
      setMessage("Usuario eliminado correctamente.");
    } catch (error) {
      console.error("Error al eliminar usuario", error);
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el usuario.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administracion"
        title="Usuarios"
        description="Usuarios reales de Supabase Auth conectados a perfiles de la app."
        action={<span className="badge neutral">{message}</span>}
      />

      <section className="card" style={{ marginBottom: 18 }}>
        <h2>Crear usuario</h2>
        <div className="form-grid">
          <label className="field">
            Nombre
            <input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
          </label>
          <label className="field">
            Email
            <input onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" value={form.email} />
          </label>
          <label className="field">
            Contrasena
            <input
              autoComplete="new-password"
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              type="password"
              value={form.password}
            />
          </label>
          <label className="field">
            Rol
            <select onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })} value={form.role}>
              <option value="admin">Admin</option>
              <option value="trabajador">Trabajador</option>
            </select>
          </label>
          <label className="field">
            Estado
            <select
              onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}
              value={String(form.active)}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>
          <button className="btn" disabled={loading} onClick={addUser} type="button">
            <Plus size={18} />
            Crear usuario
          </button>
        </div>
      </section>

      <section className="card">
        <div className="mobile-card-list">
          {users.map((user) => (
            <article className="mobile-record-card" key={user.id}>
              <div className="mobile-record-header">
                <div>
                  <h3>{user.name || "Usuario sin nombre"}</h3>
                  <p className="muted">{user.email}</p>
                </div>
                <span className={`badge ${user.active ? "positive" : "neutral"}`}>
                  {user.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="form-grid">
                <label className="field">
                  Nombre
                  <input onChange={(event) => updateUser(user.id, { name: event.target.value })} value={user.name} />
                </label>
                <label className="field">
                  Email
                  <input
                    onChange={(event) => updateUser(user.id, { email: event.target.value })}
                    type="email"
                    value={user.email}
                  />
                </label>
                <label className="field">
                  Rol
                  <select
                    onChange={(event) => updateUser(user.id, { role: event.target.value as UserRole })}
                    value={user.role}
                  >
                    <option value="admin">Admin</option>
                    <option value="trabajador">Trabajador</option>
                  </select>
                </label>
                <label className="field">
                  Estado
                  <select
                    onChange={(event) => updateUser(user.id, { active: event.target.value === "true" })}
                    value={String(user.active)}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </label>
                <label className="field full">
                  Cambiar contrasena
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.id]: event.target.value }))}
                    placeholder="Opcional"
                    type="password"
                    value={passwordDrafts[user.id] ?? ""}
                  />
                </label>
              </div>
              <div className="actions mobile-actions">
                <button
                  className="btn secondary"
                  disabled={savingId === user.id}
                  onClick={() => saveUser(user)}
                  type="button"
                >
                  <Save size={17} />
                  Guardar
                </button>
                <button className="btn ghost" onClick={() => deleteUser(user)} type="button">
                  <Trash2 size={17} />
                  Eliminar
                </button>
              </div>
            </article>
          ))}
          {!loading && users.length === 0 ? (
            <article className="mobile-record-card">
              <p className="muted">No hay usuarios registrados.</p>
            </article>
          ) : null}
        </div>

        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Cambiar contrasena</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input onChange={(event) => updateUser(user.id, { name: event.target.value })} value={user.name} />
                  </td>
                  <td>
                    <input
                      onChange={(event) => updateUser(user.id, { email: event.target.value })}
                      type="email"
                      value={user.email}
                    />
                  </td>
                  <td>
                    <select
                      onChange={(event) => updateUser(user.id, { role: event.target.value as UserRole })}
                      value={user.role}
                    >
                      <option value="admin">Admin</option>
                      <option value="trabajador">Trabajador</option>
                    </select>
                  </td>
                  <td>
                    <select
                      onChange={(event) => updateUser(user.id, { active: event.target.value === "true" })}
                      value={String(user.active)}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </td>
                  <td>
                    <input
                      autoComplete="new-password"
                      onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.id]: event.target.value }))}
                      placeholder="Opcional"
                      type="password"
                      value={passwordDrafts[user.id] ?? ""}
                    />
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn secondary"
                        disabled={savingId === user.id}
                        onClick={() => saveUser(user)}
                        type="button"
                      >
                        <Save size={17} />
                      </button>
                      <button className="btn ghost" onClick={() => deleteUser(user)} type="button">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={6}>
                    No hay usuarios registrados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
