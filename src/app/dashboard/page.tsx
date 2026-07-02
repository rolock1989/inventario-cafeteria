"use client";

import { AlertTriangle, CalendarClock, ClipboardList, PackageCheck } from "lucide-react";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { PageHeader } from "@/components/PageHeader";
import {
  filterInventoriesByDateRange,
  formatCLP,
  formatDateForInput,
  formatDateTime,
  getInventoryTotalLoss,
  getItemLossAmount
} from "@/lib/inventory";
import { listInventories, loadCurrentUser } from "@/lib/repositories";
import { InventoryRecord } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);
  const [message, setMessage] = useState("Cargando resumen...");
  const [isAdmin, setIsAdmin] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [records, user] = await Promise.all([listInventories(), loadCurrentUser()]);
        setInventories(records);
        setIsAdmin(user.role === "admin");

        if (records.length > 0) {
          const times = records.map((inventory) => new Date(inventory.submittedAt ?? inventory.createdAt).getTime());
          setStartDate(formatDateForInput(new Date(Math.min(...times))));
          setEndDate(formatDateForInput(new Date(Math.max(...times))));
        }

        setMessage(records.length > 0 ? "Resumen actualizado." : "Aun no hay inventarios enviados.");
      } catch (error) {
        console.error("Error al cargar dashboard", error);
        setMessage(error instanceof Error ? error.message : "No se pudo cargar el dashboard.");
      }
    }

    loadDashboard();
  }, []);

  const latestInventory = inventories[0];
  const filteredInventories = useMemo(
    () => filterInventoriesByDateRange(inventories, startDate, endDate),
    [endDate, inventories, startDate]
  );
  const rangeSummary = useMemo(
    () =>
      filteredInventories.reduce(
        (summary, inventory) => ({
          inventories: summary.inventories + 1,
          totalProducts: summary.totalProducts + inventory.items.length,
          productsWithDifferences:
            summary.productsWithDifferences + inventory.items.filter((item) => item.difference !== 0).length,
          totalLoss: summary.totalLoss + getInventoryTotalLoss(inventory)
        }),
        {
          inventories: 0,
          totalProducts: 0,
          productsWithDifferences: 0,
          totalLoss: 0
        }
      ),
    [filteredInventories]
  );
  const differentItems = useMemo(() => latestInventory?.items.filter((item) => item.difference !== 0) ?? [], [latestInventory]);
  const topLossItems = useMemo(
    () =>
      [...(latestInventory?.items ?? [])]
        .filter((item) => getItemLossAmount(item) > 0)
        .sort((a, b) => getItemLossAmount(b) - getItemLossAmount(a))
        .slice(0, 5),
    [latestInventory]
  );

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Resumen de inventario"
        description="Vista rapida de inventarios fisicos comparados con FUDO."
        action={<span className="badge neutral">{message}</span>}
      />

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="form-grid">
          <label className="field">
            Fecha de inicio
            <input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          </label>
          <label className="field">
            Fecha de termino
            <input onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          </label>
        </div>
      </section>

      <section className="grid cols-4">
        <article className="card metric">
          <div>
            <p className="muted">Inventarios</p>
            <p className="metric-value">{rangeSummary.inventories}</p>
          </div>
          <span className="icon-pill">
            <ClipboardList size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Productos revisados</p>
            <p className="metric-value">{rangeSummary.totalProducts}</p>
          </div>
          <span className="icon-pill">
            <PackageCheck size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Con diferencias</p>
            <p className="metric-value">{rangeSummary.productsWithDifferences}</p>
          </div>
          <span className="icon-pill">
            <AlertTriangle size={22} />
          </span>
        </article>
        {isAdmin ? (
          <article className="card metric">
            <div>
              <p className="muted">Monto total de perdidas</p>
              <p className="metric-value">{formatCLP(rangeSummary.totalLoss)}</p>
            </div>
          </article>
        ) : null}
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

        {isAdmin ? (
          <article className="card">
            <div className="section-title">
              <div>
                <p className="eyebrow">Perdida ultimo inventario</p>
                <h2>{formatCLP(getInventoryTotalLoss(latestInventory))}</h2>
              </div>
            </div>
            <p className="muted">Calculada solo para productos con stock fisico menor al stock FUDO.</p>
          </article>
        ) : null}

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

        {isAdmin ? (
          <article className="card">
            <div className="section-title">
              <div>
                <p className="eyebrow">Mayor perdida</p>
                <h2>Productos prioritarios</h2>
              </div>
            </div>
            <div className="mobile-card-list">
              {topLossItems.map((item) => (
                <article className="mobile-record-card compact" key={item.id}>
                  <div className="mobile-record-header">
                    <div>
                      <h3>{item.productName}</h3>
                      <p className="muted">{item.category}</p>
                    </div>
                    <span className="badge negative">{formatCLP(getItemLossAmount(item))}</span>
                  </div>
                </article>
              ))}
              {topLossItems.length === 0 ? (
                <article className="mobile-record-card compact">
                  <p className="muted">No hay perdidas para mostrar.</p>
                </article>
              ) : null}
            </div>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoria</th>
                    <th>Monto pérdida</th>
                  </tr>
                </thead>
                <tbody>
                  {topLossItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td>{item.category}</td>
                      <td>{formatCLP(getItemLossAmount(item))}</td>
                    </tr>
                  ))}
                  {topLossItems.length === 0 ? (
                    <tr>
                      <td className="muted" colSpan={3}>
                        No hay perdidas para mostrar.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}
      </section>
    </>
  );
}
