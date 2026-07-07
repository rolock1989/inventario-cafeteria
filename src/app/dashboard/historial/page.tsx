"use client";

import { Download, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import {
  filterInventoriesByDateRange,
  formatCLP,
  formatDateForInput,
  formatDateTime,
  getInventoryTotalLoss,
  summarizeInventory
} from "@/lib/inventory";
import { downloadInventoriesExcel } from "@/lib/excel";
import { deleteInventoryRecord, listAreas, listInventories, loadCurrentUser } from "@/lib/repositories";
import { Area, InventoryRecord } from "@/lib/types";
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaFilter, setAreaFilter] = useState("todas");
  const [workerAreaName, setWorkerAreaName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const user = await loadCurrentUser();
        const [records, loadedAreas] = await Promise.all([
          listInventories(),
          user.role === "admin" ? listAreas({ activeOnly: true }) : Promise.resolve([])
        ]);
        setInventories(records);
        setIsAdmin(user.role === "admin");
        setAreas(loadedAreas);
        setWorkerAreaName(user.areaName ?? "Sin area");

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
      const matchesArea = areaFilter === "todas" || inventory.areaId === areaFilter;
      const matchesUser = userFilter === "todos" || inventory.userName === userFilter;
      return matchesArea && matchesUser;
    });
  }, [areaFilter, endDate, inventories, startDate, userFilter]);

  async function exportExcel() {
    const filenameStart = startDate || "inicio";
    const filenameEnd = endDate || "termino";
    await downloadInventoriesExcel(filteredInventories, `inventarios-${filenameStart}-${filenameEnd}.xlsx`, isAdmin);
  }

  async function deleteInventory(inventory: InventoryRecord) {
    const confirmed = window.confirm(`Eliminar el inventario de ${inventory.userName} del ${formatDateTime(inventory.submittedAt)}?`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(inventory.id);
      await deleteInventoryRecord(inventory.id);
      setInventories((current) => current.filter((currentInventory) => currentInventory.id !== inventory.id));
      setMessage("Inventario eliminado correctamente.");
    } catch (error) {
      console.error("Error al eliminar inventario", error);
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el inventario.");
    } finally {
      setDeletingId(null);
    }
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
          {isAdmin ? (
            <label className="field">
              Área
              <select onChange={(event) => setAreaFilter(event.target.value)} value={areaFilter}>
                <option value="todas">Todas las áreas</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="field">
              <label>Área</label>
              <span className="badge neutral">{workerAreaName}</span>
            </div>
          )}
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
                  <p className="muted">{inventory.areaName ?? "Sin area"}</p>
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
                  {isAdmin ? (
                    <>
                      <span>Monto pérdida</span>
                      <strong>{formatCLP(getInventoryTotalLoss(inventory))}</strong>
                    </>
                  ) : null}
                </div>
                <Link className="btn secondary mobile-full-button" href={`/dashboard/historial/${inventory.id}`}>
                  <Eye size={17} />
                  Ver detalle
                </Link>
                {isAdmin ? (
                  <button
                    className="btn ghost mobile-full-button"
                    disabled={deletingId === inventory.id}
                    onClick={() => deleteInventory(inventory)}
                    type="button"
                  >
                    <Trash2 size={17} />
                    Eliminar
                  </button>
                ) : null}
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
                <th>Área</th>
                <th>Turno</th>
                <th>Productos</th>
                <th>Con diferencias</th>
                <th>Balance</th>
                {isAdmin ? <th>Monto pérdida</th> : null}
                <th>Detalle</th>
                {isAdmin ? <th>Eliminar</th> : null}
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
                    <td>{inventory.areaName ?? "Sin area"}</td>
                    <td>{inventory.shift}</td>
                    <td>{summary.totalProducts}</td>
                    <td>{summary.productsWithDifferences}</td>
                    <td>
                      <DifferenceBadge value={totalDifference} />
                    </td>
                    {isAdmin ? (
                      <td>{formatCLP(getInventoryTotalLoss(inventory))}</td>
                    ) : null}
                    <td>
                      <Link className="btn secondary" href={`/dashboard/historial/${inventory.id}`}>
                        <Eye size={17} />
                        Ver
                      </Link>
                    </td>
                    {isAdmin ? (
                      <td>
                        <button
                          className="btn ghost"
                          disabled={deletingId === inventory.id}
                          onClick={() => deleteInventory(inventory)}
                          type="button"
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {filteredInventories.length === 0 ? (
                <tr>
                    <td className="muted" colSpan={isAdmin ? 10 : 8}>
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
