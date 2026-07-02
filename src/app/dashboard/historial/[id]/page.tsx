"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatCLP, formatDateTime, getInventoryTotalLoss, getItemLossAmount, summarizeInventory } from "@/lib/inventory";
import { getInventoryRecord, loadCurrentUser } from "@/lib/repositories";
import { InventoryRecord } from "@/lib/types";
import { useEffect, useState } from "react";

export default function InventoryDetailPage({ params }: { params: { id: string } }) {
  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [message, setMessage] = useState("Cargando detalle...");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadInventory() {
      try {
        const [record, user] = await Promise.all([getInventoryRecord(params.id), loadCurrentUser()]);
        setInventory(record ?? null);
        setIsAdmin(user.role === "admin");
        setMessage(record ? "Detalle cargado." : "Inventario no encontrado.");
      } catch (error) {
        console.error("Error al cargar detalle de inventario", error);
        setMessage(error instanceof Error ? error.message : "No se pudo cargar el detalle.");
      }
    }

    loadInventory();
  }, [params.id]);

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
        description={`Realizado por ${inventory.userName}, ${inventory.shift}.`}
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
        <div className="mobile-card-list">
          {inventory.items.map((item) => (
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
              {inventory.items.map((item) => (
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
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
