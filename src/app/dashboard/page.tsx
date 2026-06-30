"use client";

import { AlertTriangle, CalendarClock, PackageCheck, TrendingDown, TrendingUp } from "lucide-react";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime, summarizeInventory } from "@/lib/inventory";
import { listInventories } from "@/lib/repositories";
import { InventoryRecord } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);
  const [message, setMessage] = useState("Cargando resumen...");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const records = await listInventories();
        setInventories(records);
        setMessage(records.length > 0 ? "Resumen actualizado." : "Aun no hay inventarios enviados.");
      } catch (error) {
        console.error("Error al cargar dashboard", error);
        setMessage(error instanceof Error ? error.message : "No se pudo cargar el dashboard.");
      }
    }

    loadDashboard();
  }, []);

  const latestInventory = inventories[0];
  const summary = summarizeInventory(latestInventory);
  const differentItems = useMemo(() => latestInventory?.items.filter((item) => item.difference !== 0) ?? [], [latestInventory]);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Resumen de inventario"
        description="Vista rapida del ultimo inventario fisico comparado con FUDO."
        action={<span className="badge neutral">{message}</span>}
      />

      <section className="grid cols-4">
        <article className="card metric">
          <div>
            <p className="muted">Productos revisados</p>
            <p className="metric-value">{summary.totalProducts}</p>
          </div>
          <span className="icon-pill">
            <PackageCheck size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Con diferencias</p>
            <p className="metric-value">{summary.productsWithDifferences}</p>
          </div>
          <span className="icon-pill">
            <AlertTriangle size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Diferencias positivas</p>
            <p className="metric-value">{summary.positiveDifferences}</p>
          </div>
          <span className="icon-pill">
            <TrendingUp size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Diferencias negativas</p>
            <p className="metric-value">{summary.negativeDifferences}</p>
          </div>
          <span className="icon-pill">
            <TrendingDown size={22} />
          </span>
        </article>
      </section>

      <section className="grid cols-2" style={{ marginTop: 18 }}>
        <article className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Ultimo envio</p>
              <h2>{formatDateTime(latestInventory?.submittedAt)}</h2>
            </div>
            <span className="icon-pill">
              <CalendarClock size={22} />
            </span>
          </div>
          <p className="muted">Realizado por {latestInventory?.userName ?? "Sin usuario"}.</p>
          <span className="badge">{latestInventory?.shift ?? "Sin turno"}</span>
        </article>

        <article className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Productos con diferencia</p>
              <h2>Revision prioritaria</h2>
            </div>
          </div>
          <div className="mobile-card-list">
            {differentItems.map((item) => (
              <article className="mobile-record-card compact" key={item.id}>
                <div className="mobile-record-header">
                  <div>
                    <h3>{item.productName}</h3>
                    <p className="muted">{item.category}</p>
                  </div>
                  <DifferenceBadge value={item.difference} />
                </div>
              </article>
            ))}
            {differentItems.length === 0 ? (
              <article className="mobile-record-card compact">
                <p className="muted">No hay diferencias para mostrar.</p>
              </article>
            ) : null}
          </div>
          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {differentItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>{item.category}</td>
                    <td>
                      <DifferenceBadge value={item.difference} />
                    </td>
                  </tr>
                ))}
                {differentItems.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={3}>
                      No hay diferencias para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}
