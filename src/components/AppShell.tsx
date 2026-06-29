"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Coffee, History, Package, Users, ClipboardList, LogOut } from "lucide-react";
import { loadCurrentUser } from "@/lib/repositories";
import { useEffect, useState } from "react";
import { AppUser } from "@/lib/types";
import { signOut } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: BarChart3, roles: ["admin"] },
  { href: "/dashboard/inventario", label: "Inventario", icon: ClipboardList, roles: ["admin", "trabajador"] },
  { href: "/dashboard/productos", label: "Productos", icon: Package, roles: ["admin"] },
  { href: "/dashboard/historial", label: "Historial", icon: History, roles: ["admin", "trabajador"] },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<AppUser>({
    id: "",
    name: "Cargando usuario",
    email: "",
    role: "trabajador",
    shift: "",
    active: true
  });

  useEffect(() => {
    loadCurrentUser()
      .then((loadedUser) => {
        setUser(loadedUser);
        setAuthChecked(true);
      })
      .catch((error) => {
        console.error("Error al cargar usuario actual", error);
        router.replace("/");
      });
  }, [router]);

  const visibleItems = navItems.filter((item) => item.roles.includes(user.role));
  const currentNavItem = [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const hasPermission = !currentNavItem || currentNavItem.roles.includes(user.role);

  useEffect(() => {
    if (!authChecked || hasPermission) {
      return;
    }

    setMessage("No tienes permisos para ver esta pagina.");
  }, [authChecked, hasPermission]);

  async function handleSignOut() {
    try {
      await signOut();
      router.replace("/");
    } catch (error) {
      console.error("Error al cerrar sesion", error);
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar sesion.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <Coffee size={24} />
          </span>
          Inventario Cafe
        </Link>
        <nav className="nav-list" aria-label="Principal">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link className={`nav-item ${active ? "active" : ""}`} href={item.href} key={item.href}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <strong>{user.name}</strong>
          <br />
          {user.role === "admin" ? "Administrador" : "Trabajador"}
          <br />
          {user.email}
          <button className="btn secondary logout-button" onClick={handleSignOut} type="button">
            <LogOut size={17} />
            Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="main">
        {!authChecked ? (
          <section className="card">
            <p className="muted">Cargando sesion...</p>
          </section>
        ) : !hasPermission ? (
          <section className="card">
            <h1>No tienes permisos</h1>
            <p className="muted">{message}</p>
            <Link className="btn" href="/dashboard">
              Volver al inicio
            </Link>
          </section>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
