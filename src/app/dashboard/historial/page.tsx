"use client";

import { Download, Eye, Loader2, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAppUser } from "@/components/AppUserContext";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { formatCLP, formatDateForInput, formatDateTime } from "@/lib/inventory";
import { downloadInventoriesExcel } from "@/lib/excel";
import { startDevMeasurement } from "@/lib/dev-performance";
import {
  deleteInventoryRecord,
  listAreas,
  listInventories,
  listInventorySummaries
} from "@/lib/repositories";
import { Area, InventoryListRecord } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const pageSize = 20;

function todayForInput() {
  return formatDateForInput(new Date());
}

export default function HistoryPage() {
  const user = useAppUser();
  const isAdmin = user.role === "admin";
  const requestId = useRef(0);
  const areasRequestedRef = useRef(false);
  const lastQueryKeyRef = useRef("");
  const [inventories, setInventories] = useState<InventoryListRecord[]>([]);
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayForInput);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaFilter, setAreaFilter] = useState(isAdmin ? "todas" : user.areaId ?? "");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Cargando historial...");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedAreaId = areaFilter && areaFilter !== "todas" ? areaFilter : undefined;
  const selectedUserName = userFilter !== "todos" ? userFilter : undefined;

  useEffect(() => {
    if (!isAdmin || areasRequestedRef.current) return;
    areasRequestedRef.current = true;
    listAreas({ activeOnly: true })
      .then(setAreas)
      .catch((loadError) => console.error("Error al cargar areas del historial", loadError));
  }, [isAdmin]);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!isAdmin && !selectedAreaId) return;

      const endMeasurement = startDevMeasurement("historial / solicitud hasta datos disponibles");
      const currentRequest = ++requestId.current;
      append ? setLoadingMore(true) : setLoading(true);
      if (!append) {
        setInventories([]);
        setUserOptions([]);
        setTotal(0);
        setHasMore(false);
      }
      setError("");

      try {
        const result = await listInventorySummaries({
          areaId: selectedAreaId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          userName: selectedUserName,
          page: nextPage,
          pageSize
        });

        if (currentRequest !== requestId.current) return;

        setInventories((current) => (append ? [...current, ...result.records] : result.records));
        setPage(nextPage);
        setTotal(result.total);
        setHasMore(result.hasMore);
        if (!append) setUserOptions(result.userNames ?? []);
        setStatus(result.total > 0 ? `${result.total} inventarios encontrados.` : "No hay inventarios para estos filtros.");
        endMeasurement({ records: result.records.length, page: nextPage, append });
      } catch (loadError) {
        if (currentRequest !== requestId.current) return;
        endMeasurement({ failed: true, page: nextPage, append });
        console.error("Error al cargar historial", loadError);
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los inventarios.");
        setStatus("No se pudo cargar el historial.");
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [endDate, isAdmin, selectedAreaId, selectedUserName, startDate]
  );

  useEffect(() => {
    const queryKey = JSON.stringify([selectedAreaId ?? "todas", startDate, endDate, selectedUserName ?? "todos"]);
    if (lastQueryKeyRef.current === queryKey) return;
    lastQueryKeyRef.current = queryKey;
    loadPage(0, false);
  }, [endDate, loadPage, selectedAreaId, selectedUserName, startDate]);

  async function exportExcel() {
    try {
      setExporting(true);
      setError("");
      const records = await listInventories({
        areaId: selectedAreaId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userName: selectedUserName
      }, "historial-exportacion");

      if (records.length === 0) {
        setStatus("No hay incidencias para exportar con estos filtros.");
        return;
      }

      const filenameStart = startDate || "inicio";
      const filenameEnd = endDate || "termino";
      await downloadInventoriesExcel(records, `inventarios-${filenameStart}-${filenameEnd}.xlsx`, isAdmin);
      setStatus("Excel generado correctamente.");
    } catch (exportError) {
      console.error("Error al exportar historial", exportError);
      setError(exportError instanceof Error ? exportError.message : "No se pudo generar el Excel.");
      setStatus("No se pudo exportar el historial.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteInventory(inventory: InventoryListRecord) {
    const confirmed = window.confirm(`Eliminar el inventario de ${inventory.userName} del ${formatDateTime(inventory.submittedAt)}?`);
    if (!confirmed) return;

    try {
      setDeletingId(inventory.id);
      await deleteInventoryRecord(inventory.id);
      await loadPage(0, false);
      setStatus("Inventario eliminado correctamente.");
    } catch (deleteError) {
      console.error("Error al eliminar inventario", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el inventario.");
    } finally {
      setDeletingId(null);
    }
  }

  const empty = !loading && !error && inventories.length === 0;

  return (
    <>
      <PageHeader eyebrow="Registros enviados" title="Historial" description="Consulta inventarios anteriores por fecha y responsable." action={<span className="badge neutral">{status}</span>} />

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="form-grid">
          {isAdmin ? (
            <label className="field">
              Área
              <select onChange={(event) => { setAreaFilter(event.target.value); setUserFilter("todos"); }} value={areaFilter}>
                <option value="todas">Todas las áreas</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="field"><label>Área</label><span className="badge neutral">{user.areaName ?? "Sin area"}</span></div>
          )}
          <label className="field">Fecha de inicio<input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label>
          <label className="field">Fecha de termino<input onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></label>
          <label className="field">
            Usuario
            <select onChange={(event) => setUserFilter(event.target.value)} value={userFilter}>
              <option value="todos">Todos</option>
              {userOptions.map((userName) => <option key={userName} value={userName}>{userName}</option>)}
            </select>
          </label>
          <div className="field">
            <label>Exportacion</label>
            <button className="btn" disabled={loading || exporting || Boolean(error) || total === 0} onClick={exportExcel} type="button">
              {exporting ? <Loader2 className="spin" size={18} /> : <Download size={18} />}
              {exporting ? "Preparando..." : "Descargar Excel"}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="card error-state" style={{ marginBottom: 18 }}>
          <div><h2>No se pudieron cargar los registros</h2><p className="muted">{error}</p></div>
          <button className="btn secondary" onClick={() => loadPage(0, false)} type="button"><RefreshCw size={18} /> Reintentar</button>
        </section>
      ) : null}

      <section className="card" aria-busy={loading}>
        {loading ? <div className="loading-state"><Loader2 className="spin" size={24} /><p>Cargando inventarios...</p></div> : null}

        {!loading && !error ? (
          <>
            <div className="mobile-card-list">
              {inventories.map((inventory) => (
                <article className="mobile-record-card" key={inventory.id}>
                  <div className="mobile-record-header">
                    <div><h3>{formatDateTime(inventory.submittedAt)}</h3><p className="muted">{inventory.userName}</p><p className="muted">{inventory.areaName ?? "Sin area"}</p></div>
                    <DifferenceBadge value={inventory.totalDifference} />
                  </div>
                  <div className="mobile-meta-grid">
                    <span>Turno</span><strong>{inventory.shift}</strong><span>Productos</span><strong>{inventory.totalProducts}</strong>
                    <span>Con diferencias</span><strong>{inventory.productsWithDifferences}</strong>
                    {isAdmin ? <><span>Monto pérdida</span><strong>{formatCLP(inventory.totalLoss)}</strong></> : null}
                  </div>
                  <Link className="btn secondary mobile-full-button" href={`/dashboard/historial/${inventory.id}`}><Eye size={17} /> Ver detalle</Link>
                  {isAdmin ? <button className="btn ghost mobile-full-button" disabled={deletingId === inventory.id} onClick={() => deleteInventory(inventory)} type="button"><Trash2 size={17} /> Eliminar</button> : null}
                </article>
              ))}
              {empty ? <article className="mobile-record-card"><p className="muted">No hay inventarios para los filtros seleccionados.</p></article> : null}
            </div>

            <div className="table-wrap desktop-table">
              <table>
                <thead><tr><th>Fecha</th><th>Usuario</th><th>Área</th><th>Turno</th><th>Productos</th><th>Con diferencias</th><th>Balance</th>{isAdmin ? <th>Monto pérdida</th> : null}<th>Detalle</th>{isAdmin ? <th>Eliminar</th> : null}</tr></thead>
                <tbody>
                  {inventories.map((inventory) => (
                    <tr key={inventory.id}>
                      <td>{formatDateTime(inventory.submittedAt)}</td><td>{inventory.userName}</td><td>{inventory.areaName ?? "Sin area"}</td><td>{inventory.shift}</td>
                      <td>{inventory.totalProducts}</td><td>{inventory.productsWithDifferences}</td><td><DifferenceBadge value={inventory.totalDifference} /></td>
                      {isAdmin ? <td>{formatCLP(inventory.totalLoss)}</td> : null}
                      <td><Link className="btn secondary" href={`/dashboard/historial/${inventory.id}`}><Eye size={17} /> Ver</Link></td>
                      {isAdmin ? <td><button className="btn ghost" disabled={deletingId === inventory.id} onClick={() => deleteInventory(inventory)} type="button"><Trash2 size={17} /></button></td> : null}
                    </tr>
                  ))}
                  {empty ? <tr><td className="muted" colSpan={isAdmin ? 10 : 8}>No hay inventarios para los filtros seleccionados.</td></tr> : null}
                </tbody>
              </table>
            </div>

            {hasMore ? (
              <div className="load-more-row">
                <button className="btn secondary" disabled={loadingMore} onClick={() => loadPage(page + 1, true)} type="button">
                  {loadingMore ? <Loader2 className="spin" size={18} /> : null}{loadingMore ? "Cargando..." : "Cargar más"}
                </button>
                <span className="muted">Mostrando {inventories.length} de {total}</span>
              </div>
            ) : inventories.length > 0 ? <p className="muted list-count">Mostrando {inventories.length} de {total}</p> : null}
          </>
        ) : null}
      </section>
    </>
  );
}
