"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createUser, deleteUserRecord, listUsers, updateUserRecord } from "@/lib/repositories";
import { AppUser, UserRole } from "@/lib/types";
import { useEffect, useState } from "react";

const emptyUser: Omit<AppUser, "id"> = {
  name: "",
  email: "",
  role: "trabajador",
  shift: "",
  active: true
};

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState(emptyUser);
  const [message, setMessage] = useState("Cargando usuarios...");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setUsers(await listUsers());
      setMessage("Usuarios cargados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser() {
    if (!form.name.trim() || !form.email.trim()) {
      setMessage("Completa nombre y email.");
      return;
    }

    try {
      const createdUser = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        shift: form.shift?.trim() ?? "",
        active: form.active
      });
      setUsers((current) => [...current, createdUser].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setForm(emptyUser);
      setMessage("Usuario guardado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el usuario.");
    }
  }

  function updateUser(id: string, patch: Partial<AppUser>) {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  }

  async function saveUser(user: AppUser) {
    try {
      setSavingId(user.id);
      await updateUserRecord(user.id, {
        name: user.name.trim(),
        email: user.email.trim(),
        role: user.role,
        shift: user.shift?.trim() ?? "",
        active: user.active
      });
      setMessage("Usuario guardado correctamente.");
    } catch (error) {
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
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el usuario.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administracion"
        title="Usuarios"
        description="Usuarios operativos persistentes, listos para enlazar con Supabase Auth."
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
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
                  <td className="muted" colSpan={5}>
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
