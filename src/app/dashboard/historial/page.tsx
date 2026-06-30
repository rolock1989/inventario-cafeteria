"use client";

import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { filterInventoriesByDateRange, formatDateForInput, formatDateTime, summarizeInventory } from "@/lib/inventory";
import { downloadInventoriesExcel } from "@/lib/excel";
import { listInventories } from "@/lib/repositories";
import { InventoryRecord } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

function todayForInput() {
  return formatDateForInput(new Date());
}

export default function HistoryPage() {
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);
  const [userFilter, setUserFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayForInput);
  const [message, setMessage] = useState("Cargando historial...");

  useEffect(() => {
    async function loadHistory() {
      try {
        const records = await listInventories();
        setInventories(records);

        if (records.length > 0) {
          const times = records.map((inventory) => new Date(inventory.submittedAt ?? inventory.createdAt).getTime());
          setStartDate(formatDateForInput(new Date(Math.min(...times))));
          setEndDate(formatDateForInput(new Date(Math.max(...times))));
        }

        setMessage(records.length > 0 ? "Historial cargado." : "Aun no hay inventarios enviados.");
      } catch (error) {
        console.error("Error al cargar historial", error);
        setMessage(error instanceof Error ? error.message : "No se pudo cargar el historial.");
      }
    }

    loadHistory();
  }, []);

  const userOptions = Array.from(new Set(inventories.map((inventory) => inventory.userName)));

  const filteredInventories = useMemo(() => {
    const inventoriesInRange = filterInventoriesByDateRange(inventories, startDate, endDate);

    return inventoriesInRange.filter((inventory) => {
      const matchesUser = userFilter === "todos" || inventory.userName === userFilter;
      return matchesUser;
    });
  }, [endDate, inventories, startDate, userFilter]);

  async function exportExcel() {
    const filenameStart = startDate || "inicio";
    const filenameEnd = endDate || "termino";
    await downloadInventoriesExcel(filteredInventories, `inventarios-${filenameStart}-${filenameEnd}.xlsx`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Registros enviados"
        title="Historial"
        description="Consulta inventarios anteriores por fecha y responsable."
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
          <label className="field">
            Usuario
            <select onChange={(event) => setUserFilter(event.target.value)} value={userFilter}>
              <option value="todos">Todos</option>
              {userOptions.map((userName) => (
                <option key={userName} value={userName}>
                  {userName}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <label>Exportacion</label>
            <button className="btn" disabled={filteredInventories.length === 0} onClick={exportExcel} type="button">
              <Download size={18} />
              Descargar Excel
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="mobile-card-list">
          {filteredInventories.map((inventory) => {
            const summary = summarizeInventory(inventory);
            const totalDifference = inventory.items.reduce((total, item) => total + item.difference, 0);

            return (
              <article className="mobile-record-card" key={inventory.id}>
                <div className="mobile-record-header">
                  <div>
                    <h3>{formatDateTime(inventory.submittedAt)}</h3>
                    <p className="muted">{inventory.userName}</p>
                  </div>
                  <DifferenceBadge value={totalDifference} />
                </div>
                <div className="mobile-meta-grid">
                  <span>Turno</span>
                  <strong>{inventory.shift}</strong>
                  <span>Productos</span>
                  <strong>{summary.totalProducts}</strong>
                  <span>Con diferencias</span>
                  <strong>{summary.productsWithDifferences}</strong>
                </div>
                <Link className="btn secondary mobile-full-button" href={`/dashboard/historial/${inventory.id}`}>
                  <Eye size={17} />
                  Ver detalle
                </Link>
              </article>
            );
          })}
          {filteredInventories.length === 0 ? (
            <article className="mobile-record-card">
              <p className="muted">No hay inventarios para los filtros seleccionados.</p>
            </article>
          ) : null}
        </div>

        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Turno</th>
                <th>Productos</th>
                <th>Con diferencias</th>
                <th>Balance</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventories.map((inventory) => {
                const summary = summarizeInventory(inventory);
                const totalDifference = inventory.items.reduce((total, item) => total + item.difference, 0);

                return (
                  <tr key={inventory.id}>
                    <td>{formatDateTime(inventory.submittedAt)}</td>
                    <td>{inventory.userName}</td>
                    <td>{inventory.shift}</td>
                    <td>{summary.totalProducts}</td>
                    <td>{summary.productsWithDifferences}</td>
                    <td>
                      <DifferenceBadge value={totalDifference} />
                    </td>
                    <td>
                      <Link className="btn secondary" href={`/dashboard/historial/${inventory.id}`}>
                        <Eye size={17} />
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredInventories.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={7}>
                    No hay inventarios para los filtros seleccionados.
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
