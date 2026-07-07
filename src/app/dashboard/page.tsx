"use client";

import { CalendarClock, ClipboardList, PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  filterInventoriesByDateRange,
  formatCLP,
  formatDateTime,
  getInventoryTotalLoss,
  getItemLossAmount
} from "@/lib/inventory";
import { listAreas, listInventories, loadCurrentUser } from "@/lib/repositories";
import { Area, InventoryItem, InventoryRecord } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type ProductLossRankingItem = {
  key: string;
  position: number;
  productName: string;
  category: string;
  unit: string;
  missingQuantity: number;
  totalLoss: number;
};

function productRankingKey(item: InventoryItem, inventory: InventoryRecord) {
  return item.productId || `${inventory.areaId ?? "sin-area"}-${item.productName.trim().toLowerCase()}-${item.category.trim().toLowerCase()}`;
}

function formatQuantity(value: number, unit: string) {
  const formattedValue = new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 2
  }).format(value);

  return `${formattedValue} ${unit}`;
}

function formatLocalDateForInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatCurrentDateTime(value: Date) {
  const locale = typeof navigator !== "undefined" ? navigator.language : "es-CL";
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(value);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);

  return {
    date: date.charAt(0).toUpperCase() + date.slice(1),
    time: `${time} hrs`
  };
}

export default function DashboardPage() {
  const [inventories, setInventories] = useState<InventoryRecord[]>([]);
  const [message, setMessage] = useState("Cargando resumen...");
  const [isAdmin, setIsAdmin] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaFilter, setAreaFilter] = useState("todas");
  const [workerAreaName, setWorkerAreaName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  useEffect(() => {
    async function loadDashboard() {
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
          setStartDate(formatLocalDateForInput(new Date(Math.min(...times))));
          setEndDate(formatLocalDateForInput(new Date(Math.max(...times))));
        }

        setMessage(records.length > 0 ? "Resumen actualizado." : "Aun no hay inventarios enviados.");
      } catch (error) {
        console.error("Error al cargar dashboard", error);
        setMessage(error instanceof Error ? error.message : "No se pudo cargar el dashboard.");
      }
    }

    loadDashboard();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentDateTime(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredInventories = useMemo(
    () =>
      filterInventoriesByDateRange(inventories, startDate, endDate).filter(
        (inventory) => areaFilter === "todas" || inventory.areaId === areaFilter
      ),
    [areaFilter, endDate, inventories, startDate]
  );
  const latestInventory = filteredInventories[0];
  const hasInventoriesInRange = filteredInventories.length > 0;
  const formattedCurrentDateTime = useMemo(() => formatCurrentDateTime(currentDateTime), [currentDateTime]);
  const rangeSummary = useMemo(
    () =>
      filteredInventories.reduce(
        (summary, inventory) => ({
          inventories: summary.inventories + 1,
          totalProducts: summary.totalProducts + inventory.items.length,
          totalLoss: summary.totalLoss + getInventoryTotalLoss(inventory)
        }),
        {
          inventories: 0,
          totalProducts: 0,
          totalLoss: 0
        }
      ),
    [filteredInventories]
  );
  const productLossRanking = useMemo(
    () =>
      Array.from(
        filteredInventories
          .flatMap((inventory) => inventory.items.map((item) => ({ inventory, item })))
          .filter(({ item }) => item.physicalStock < item.fudoStock)
          .reduce<Map<string, ProductLossRankingItem>>((ranking, item) => {
            const key = productRankingKey(item.item, item.inventory);
            const current = ranking.get(key);
            const missingQuantity = item.item.fudoStock - item.item.physicalStock;
            const totalLoss = getItemLossAmount(item.item);

            if (!current) {
              ranking.set(key, {
                key,
                position: 0,
                productName: areaFilter === "todas" ? `${item.item.productName} (${item.inventory.areaName ?? "Sin area"})` : item.item.productName,
                category: item.item.category,
                unit: item.item.unit,
                missingQuantity,
                totalLoss
              });
              return ranking;
            }

            ranking.set(key, {
              ...current,
              missingQuantity: current.missingQuantity + missingQuantity,
              totalLoss: current.totalLoss + totalLoss
            });

            return ranking;
          }, new Map())
          .values()
      )
        .filter((item) => item.missingQuantity > 0)
        .sort((a, b) => b.missingQuantity - a.missingQuantity)
        .slice(0, 10)
        .map((item, index) => ({ ...item, position: index + 1 })),
    [areaFilter, filteredInventories]
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
        </div>
        {!hasInventoriesInRange ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>
            No hay inventarios en este rango de fechas.
          </p>
        ) : null}
      </section>

      <section className="grid cols-4">
        <article className="card metric">
          <div>
            <p className="muted">{formattedCurrentDateTime.date}</p>
            <p className="metric-value">{formattedCurrentDateTime.time}</p>
          </div>
          <span className="icon-pill">
            <CalendarClock size={22} />
          </span>
        </article>
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
      </section>

      {isAdmin ? (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="section-title">
            <div>
              <p className="eyebrow">Ranking del periodo</p>
              <h2>Top 10 productos con más faltantes</h2>
              <p className="muted">
                Ordenado por cantidad faltante total dentro del rango seleccionado.
              </p>
            </div>
          </div>
          <div className="mobile-card-list">
            {productLossRanking.map((item) => (
              <article className="mobile-record-card compact" key={item.key}>
                <div className="mobile-record-header">
                  <div>
                    <h3>{item.position}. {item.productName}</h3>
                    <p className="muted">{item.category}</p>
                  </div>
                  <span className="badge negative">{formatQuantity(item.missingQuantity, item.unit)}</span>
                </div>
                <div className="mobile-meta-grid">
                  <span>Faltante total</span>
                  <strong>{formatQuantity(item.missingQuantity, item.unit)}</strong>
                  <span>Pérdida total</span>
                  <strong>{formatCLP(item.totalLoss)}</strong>
                </div>
              </article>
            ))}
            {productLossRanking.length === 0 ? (
              <article className="mobile-record-card compact">
                <p className="muted">No hay faltantes para mostrar en el rango seleccionado.</p>
              </article>
            ) : null}
          </div>
          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Faltante total</th>
                  <th>Pérdida total</th>
                </tr>
              </thead>
              <tbody>
                {productLossRanking.map((item) => (
                  <tr key={item.key}>
                    <td>{item.position}</td>
                    <td>{item.productName}</td>
                    <td>{item.category}</td>
                    <td>{formatQuantity(item.missingQuantity, item.unit)}</td>
                    <td>{formatCLP(item.totalLoss)}</td>
                  </tr>
                ))}
                {productLossRanking.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={5}>
                      No hay faltantes para mostrar en el rango seleccionado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
