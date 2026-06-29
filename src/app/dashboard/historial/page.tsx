"use client";

import { Download, Eye } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import {
  filterInventoriesByDateRange,
  formatDateForInput,
  formatDateTime,
  getInventoryHistory,
  summarizeInventory
} from "@/lib/inventory";
import { downloadInventoriesExcel } from "@/lib/excel";
import { useMemo, useState } from "react";

export default function HistoryPage() {
  const inventories = getInventoryHistory();
  const inventoryDates = inventories.map((inventory) => new Date(inventory.submittedAt ?? inventory.createdAt).getTime());
  const initialStartDate = formatDateForInput(new Date(Math.min(...inventoryDates)));
  const initialEndDate = formatDateForInput(new Date(Math.max(...inventoryDates)));
  const [userFilter, setUserFilter] = useState("todos");
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const userOptions = Array.from(new Set(inventories.map((inventory) => inventory.userName)));

  const filteredInventories = useMemo(
    () => {
      const inventoriesInRange = filterInventoriesByDateRange(inventories, startDate, endDate);

      return inventoriesInRange.filter((inventory) => {
        const matchesUser = userFilter === "todos" || inventory.userName === userFilter;
        return matchesUser;
      });
    },
    [endDate, inventories, startDate, userFilter]
  );

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
        <div className="table-wrap">
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
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
