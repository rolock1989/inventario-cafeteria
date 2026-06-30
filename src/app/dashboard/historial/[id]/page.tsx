"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime, summarizeInventory } from "@/lib/inventory";
import { getInventoryRecord } from "@/lib/repositories";
import { InventoryRecord } from "@/lib/types";
import { useEffect, useState } from "react";

export default function InventoryDetailPage({ params }: { params: { id: string } }) {
  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [message, setMessage] = useState("Cargando detalle...");

  useEffect(() => {
    async function loadInventory() {
      try {
        const record = await getInventoryRecord(params.id);
        setInventory(record ?? null);
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
          <p className="muted">Productos</p>
          <p className="metric-value">{summary.totalProducts}</p>
        </article>
        <article className="card">
          <p className="muted">Con diferencias</p>
          <p className="metric-value">{summary.productsWithDifferences}</p>
        </article>
        <article className="card">
          <p className="muted">Positivas</p>
          <p className="metric-value">{summary.positiveDifferences}</p>
        </article>
        <article className="card">
          <p className="muted">Negativas</p>
          <p className="metric-value">{summary.negativeDifferences}</p>
        </article>
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
