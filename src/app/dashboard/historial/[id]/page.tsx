import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime, getInventoryById, summarizeInventory } from "@/lib/inventory";

export default function InventoryDetailPage({ params }: { params: { id: string } }) {
  const inventory = getInventoryById(params.id);

  if (!inventory) {
    return (
      <>
        <PageHeader title="Inventario no encontrado" description="El registro solicitado no existe en los datos demo." />
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
        <div className="table-wrap">
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
