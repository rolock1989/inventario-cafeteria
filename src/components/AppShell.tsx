"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Coffee, History, Package, Users, ClipboardList } from "lucide-react";
import { loadCurrentUser } from "@/lib/repositories";
import { useEffect, useState } from "react";
import { AppUser } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: BarChart3, roles: ["admin"] },
  { href: "/dashboard/inventario", label: "Inventario", icon: ClipboardList, roles: ["admin", "trabajador"] },
  { href: "/dashboard/productos", label: "Productos", icon: Package, roles: ["admin"] },
  { href: "/dashboard/historial", label: "Historial", icon: History, roles: ["admin"] },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      .then(setUser)
      .catch((error) => {
        console.error("Error al cargar usuario actual", error);
        setUser({
          id: "",
          name: "Error al cargar usuario",
          email: "",
          role: "trabajador",
          shift: "Revisa Supabase",
          active: false
        });
      });
  }, []);

  const visibleItems = navItems.filter((item) => item.roles.includes(user.role));

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
          {user.shift}
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
