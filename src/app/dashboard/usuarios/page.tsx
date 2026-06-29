import { PageHeader } from "@/components/PageHeader";
import { getUsers } from "@/lib/inventory";

export default function UsersPage() {
  const users = getUsers();

  return (
    <>
      <PageHeader
        eyebrow="Administracion"
        title="Usuarios"
        description="Usuarios y roles preparados para conectarse con Supabase Auth."
      />

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Turno</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="badge">{user.role}</span>
                  </td>
                  <td>{user.shift}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
