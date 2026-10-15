"use client";

import { CalendarClock, ClipboardList, Loader2, PackageCheck, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppUser } from "@/components/AppUserContext";
import { PageHeader } from "@/components/PageHeader";
import { formatCLP, formatDateTime } from "@/lib/inventory";
import { getDashboardMetrics, listAreas } from "@/lib/repositories";
import { Area, DashboardMetrics } from "@/lib/types";

function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

function formatCurrentDateTime(value: Date) {
  const locale = typeof navigator !== "undefined" ? navigator.language : "es-CL";
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(value);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
  return { date: date.charAt(0).toUpperCase() + date.slice(1), time: `${time} hrs` };
}

type DashboardFilters = {
  areaFilter: string;
  startDate: string;
  endDate: string;
};

export default function DashboardPage() {
  const user = useAppUser();
  const isAdmin = user.role === "admin";
  const initialAreaFilter = isAdmin ? "todas" : user.areaId ?? "";
  const initializedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [message, setMessage] = useState("Cargando resumen...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaFilter, setAreaFilter] = useState(initialAreaFilter);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  const loadDashboard = useCallback(async (filters: DashboardFilters, initialize = false) => {
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setMetrics(null);

    try {
      const selectedAreaId = filters.areaFilter && filters.areaFilter !== "todas" ? filters.areaFilter : undefined;
      const [result, loadedAreas] = await Promise.all([
        getDashboardMetrics({
          areaId: selectedAreaId,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined
        }),
        initialize && isAdmin ? listAreas({ activeOnly: true }) : Promise.resolve(null)
      ]);

      if (currentRequest !== requestIdRef.current) return;
      setMetrics(result);
      if (loadedAreas) setAreas(loadedAreas);
      if (initialize) {
        setStartDate(result.availableStartDate ?? "");
        setEndDate(result.availableEndDate ?? "");
      }
      setMessage(result.inventories > 0 ? "Resumen actualizado." : "No hay inventarios para estos filtros.");
    } catch (loadError) {
      if (currentRequest !== requestIdRef.current) return;
      console.error("Error al cargar dashboard", loadError);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el dashboard.");
      setMessage("No se pudo cargar el dashboard.");
    } finally {
      if (currentRequest === requestIdRef.current) setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadDashboard({ areaFilter: initialAreaFilter, startDate: "", endDate: "" }, true);
  }, [initialAreaFilter, loadDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentDateTime(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const formattedCurrentDateTime = useMemo(() => formatCurrentDateTime(currentDateTime), [currentDateTime]);
  const currentFilters = { areaFilter, startDate, endDate };

  function changeArea(nextArea: string) {
    setAreaFilter(nextArea);
    loadDashboard({ ...currentFilters, areaFilter: nextArea });
  }

  function changeStartDate(nextDate: string) {
    setStartDate(nextDate);
    loadDashboard({ ...currentFilters, startDate: nextDate });
  }

  function changeEndDate(nextDate: string) {
    setEndDate(nextDate);
    loadDashboard({ ...currentFilters, endDate: nextDate });
  }

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
          {isAdmin ? (
            <label className="field">
              Área
              <select onChange={(event) => changeArea(event.target.value)} value={areaFilter}>
                <option value="todas">Todas las áreas</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="field"><label>Área</label><span className="badge neutral">{user.areaName ?? "Sin area"}</span></div>
          )}
          <label className="field">Fecha de inicio<input onChange={(event) => changeStartDate(event.target.value)} type="date" value={startDate} /></label>
          <label className="field">Fecha de termino<input onChange={(event) => changeEndDate(event.target.value)} type="date" value={endDate} /></label>
        </div>
      </section>

      {error ? (
        <section className="card error-state" style={{ marginBottom: 18 }}>
          <div><h2>No se pudo cargar el resumen</h2><p className="muted">{error}</p></div>
          <button className="btn secondary" onClick={() => loadDashboard(currentFilters)} type="button"><RefreshCw size={18} /> Reintentar</button>
        </section>
      ) : null}

      {loading ? (
        <section className="card loading-state" aria-busy="true"><Loader2 className="spin" size={24} /><p>Cargando estadísticas...</p></section>
      ) : null}

      {!loading && !error && metrics ? (
        <>
          {metrics.inventories === 0 ? <section className="card" style={{ marginBottom: 18 }}><p className="muted">No hay inventarios en este rango de fechas.</p></section> : null}

          <section className="grid cols-4">
            <article className="card metric">
              <div><p className="muted">{formattedCurrentDateTime.date}</p><p className="metric-value">{formattedCurrentDateTime.time}</p></div>
              <span className="icon-pill"><CalendarClock size={22} /></span>
            </article>
            <article className="card metric">
              <div><p className="muted">Inventarios</p><p className="metric-value">{metrics.inventories}</p></div>
              <span className="icon-pill"><ClipboardList size={22} /></span>
            </article>
            <article className="card metric">
              <div><p className="muted">Productos revisados</p><p className="metric-value">{metrics.totalProducts}</p></div>
              <span className="icon-pill"><PackageCheck size={22} /></span>
            </article>
            {isAdmin ? <article className="card metric"><div><p className="muted">Monto total de perdidas</p><p className="metric-value">{formatCLP(metrics.totalLoss ?? 0)}</p></div></article> : null}
          </section>

          <section className="grid cols-2" style={{ marginTop: 18 }}>
            <article className="card">
              <div className="section-title"><div><p className="eyebrow">Ultimo envio</p><h2>{formatDateTime(metrics.latestInventory?.submittedAt)}</h2></div><span className="icon-pill"><CalendarClock size={22} /></span></div>
              <p className="muted">Realizado por {metrics.latestInventory?.userName ?? "Sin usuario"}.</p>
              <span className="badge">{metrics.latestInventory?.shift ?? "Sin turno"}</span>
            </article>
            {isAdmin ? (
              <article className="card">
                <div className="section-title"><div><p className="eyebrow">Perdida ultimo inventario</p><h2>{formatCLP(metrics.latestInventory?.totalLoss ?? 0)}</h2></div></div>
                <p className="muted">Calculada solo para productos con stock fisico menor al stock FUDO.</p>
              </article>
            ) : null}
          </section>

          {isAdmin ? (
            <section className="card" style={{ marginTop: 18 }}>
              <div className="section-title"><div><p className="eyebrow">Ranking del periodo</p><h2>Top 10 productos con más faltantes</h2><p className="muted">Ordenado por cantidad faltante total dentro del rango seleccionado.</p></div></div>
              <div className="mobile-card-list">
                {metrics.topMissing.map((item, index) => (
                  <article className="mobile-record-card compact" key={`${item.areaId}:${item.key}`}>
                    <div className="mobile-record-header"><div><h3>{index + 1}. {areaFilter === "todas" ? `${item.productName} (${item.areaName ?? "Sin area"})` : item.productName}</h3><p className="muted">{item.category}</p></div><span className="badge negative">{formatQuantity(item.missingQuantity, item.unit)}</span></div>
                    <div className="mobile-meta-grid"><span>Faltante total</span><strong>{formatQuantity(item.missingQuantity, item.unit)}</strong><span>Pérdida total</span><strong>{formatCLP(item.totalLoss ?? 0)}</strong></div>
                  </article>
                ))}
                {metrics.topMissing.length === 0 ? <article className="mobile-record-card compact"><p className="muted">No hay faltantes para mostrar en el rango seleccionado.</p></article> : null}
              </div>
              <div className="table-wrap desktop-table">
                <table>
                  <thead><tr><th>#</th><th>Producto</th><th>Categoria</th><th>Faltante total</th><th>Pérdida total</th></tr></thead>
                  <tbody>
                    {metrics.topMissing.map((item, index) => (
                      <tr key={`${item.areaId}:${item.key}`}><td>{index + 1}</td><td>{areaFilter === "todas" ? `${item.productName} (${item.areaName ?? "Sin area"})` : item.productName}</td><td>{item.category}</td><td>{formatQuantity(item.missingQuantity, item.unit)}</td><td>{formatCLP(item.totalLoss ?? 0)}</td></tr>
                    ))}
                    {metrics.topMissing.length === 0 ? <tr><td className="muted" colSpan={5}>No hay faltantes para mostrar en el rango seleccionado.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
