"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { PageHeader } from "@/components/PageHeader";
import { useAppUser } from "@/components/AppUserContext";
import { formatCLP, formatDateTime, getInventoryTotalLoss, getItemLossAmount, summarizeInventory } from "@/lib/inventory";
import { getInventoryRecord } from "@/lib/repositories";
import { InventoryItem, InventoryRecord } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

type IncidenceFilter = "todos" | "diferencias" | "faltantes" | "sobrantes" | "sin-diferencias";

function matchesIncidenceFilter(item: InventoryItem, filter: IncidenceFilter) {
  if (filter === "diferencias") {
    return item.difference !== 0;
  }

  if (filter === "faltantes") {
    return item.physicalStock < item.fudoStock;
  }

  if (filter === "sobrantes") {
    return item.physicalStock > item.fudoStock;
  }

  if (filter === "sin-diferencias") {
    return item.difference === 0;
  }

  return true;
}

export default function InventoryDetailPage({ params }: { params: { id: string } }) {
  const user = useAppUser();
  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [message, setMessage] = useState("Cargando detalle...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = user.role === "admin";
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [incidenceFilter, setIncidenceFilter] = useState<IncidenceFilter>("todos");

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const record = await getInventoryRecord(params.id);
      setInventory(record ?? null);
      setMessage(record ? "Detalle cargado." : "Inventario no encontrado.");
    } catch (loadError) {
      console.error("Error al cargar detalle de inventario", loadError);
      const nextError = loadError instanceof Error ? loadError.message : "No se pudo cargar el detalle.";
      setError(nextError);
      setMessage("No se pudo cargar el detalle.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const inventoryItems = useMemo(() => inventory?.items ?? [], [inventory]);
  const categoryOptions = useMemo(
    () => Array.from(new Set(inventoryItems.map((item) => item.category || "Sin categoria"))).sort((a, b) => a.localeCompare(b, "es")),
    [inventoryItems]
  );
  const filteredItems = useMemo(
    () =>
      inventoryItems.filter((item) => {
        const itemCategory = item.category || "Sin categoria";
        const matchesCategory = categoryFilter === "todas" || itemCategory === categoryFilter;
        return matchesCategory && matchesIncidenceFilter(item, incidenceFilter);
      }),
    [categoryFilter, incidenceFilter, inventoryItems]
  );

  if (loading) {
    return (
      <section className="card loading-state" aria-busy="true">
        <Loader2 className="spin" size={24} />
        <p>Cargando detalle del inventario...</p>
      </section>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Detalle de inventario" description={message} />
        <section className="card error-state">
          <div><h2>No se pudo cargar el inventario</h2><p className="muted">{error}</p></div>
          <div className="actions">
            <button className="btn" onClick={loadInventory} type="button"><RefreshCw size={18} /> Reintentar</button>
            <Link className="btn secondary" href="/dashboard/historial"><ArrowLeft size={18} /> Volver</Link>
          </div>
        </section>
      </>
    );
  }

  if (!inventory) {
    return (
      <>
        <PageHeader title="Detalle de inventario" description={message} />
        <Link className="btn secondary" href="/dashboard/historial">
          <ArrowLeft size={18} />
          Volver
        </Link>
      </>
    );
  }

  const summary = summarizeInventory(inventory);

  return (
    <>
      <PageHeader
        eyebrow="Detalle de inventario"
        title={formatDateTime(inventory.submittedAt)}
        description={`Área: ${inventory.areaName ?? "Sin area"}. Realizado por ${inventory.userName}, ${inventory.shift}.`}
        action={
          <Link className="btn secondary" href="/dashboard/historial">
            <ArrowLeft size={18} />
            Volver
          </Link>
        }
      />

      <section className="grid cols-4" style={{ marginBottom: 18 }}>
        <article className="card">
          <p className="muted">Productos revisados</p>
          <p className="metric-value">{summary.totalProducts}</p>
        </article>
        <article className="card">
          <p className="muted">Productos con diferencias</p>
          <p className="metric-value">{summary.productsWithDifferences}</p>
        </article>
        {isAdmin ? (
          <article className="card">
            <p className="muted">Monto total de perdidas</p>
            <p className="metric-value">{formatCLP(getInventoryTotalLoss(inventory))}</p>
          </article>
        ) : null}
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Productos</h2>
            <p className="muted">
              Mostrando {filteredItems.length} de {inventory.items.length} productos.
            </p>
          </div>
        </div>

        <div className="form-grid" style={{ marginBottom: 18 }}>
          <label className="field">
            Categoria
            <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="todas">Todas las categorias</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Incidencia
            <select onChange={(event) => setIncidenceFilter(event.target.value as IncidenceFilter)} value={incidenceFilter}>
              <option value="todos">Todos</option>
              <option value="diferencias">Con diferencias</option>
              <option value="faltantes">Faltantes</option>
              <option value="sobrantes">Sobrantes</option>
              <option value="sin-diferencias">Sin diferencias</option>
            </select>
          </label>
        </div>

        <div className="mobile-card-list">
          {filteredItems.map((item) => (
            <article className="mobile-record-card" key={item.id}>
              <div className="mobile-record-header">
                <div>
                  <h3>{item.productName}</h3>
                  <p className="muted">{item.category}</p>
                </div>
                <DifferenceBadge value={item.difference} />
              </div>
              <div className="mobile-meta-grid">
                <span>Unidad</span>
                <strong>{item.unit}</strong>
                <span>Fisico</span>
                <strong>{item.physicalStock}</strong>
                <span>FUDO</span>
                <strong>{item.fudoStock}</strong>
                <span>Comentario</span>
                <strong>{item.comment || "Sin comentario"}</strong>
                {isAdmin ? (
                  <>
                    <span>Monto pérdida</span>
                    <strong>{formatCLP(getItemLossAmount(item))}</strong>
                  </>
                ) : null}
              </div>
            </article>
          ))}
          {filteredItems.length === 0 ? (
            <article className="mobile-record-card">
              <p className="muted">No hay productos que coincidan con los filtros seleccionados.</p>
            </article>
          ) : null}
        </div>

        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Unidad</th>
                <th>Fisico</th>
                <th>FUDO</th>
                <th>Diferencia</th>
                {isAdmin ? <th>Monto pérdida</th> : null}
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td>{item.physicalStock}</td>
                  <td>{item.fudoStock}</td>
                  <td>
                    <DifferenceBadge value={item.difference} />
                  </td>
                  {isAdmin ? <td>{formatCLP(getItemLossAmount(item))}</td> : null}
                  <td>{item.comment || "Sin comentario"}</td>
                </tr>
              ))}
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={isAdmin ? 8 : 7}>
                    No hay productos que coincidan con los filtros seleccionados.
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
