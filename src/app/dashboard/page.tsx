import { AlertTriangle, CalendarClock, PackageCheck, TrendingDown, TrendingUp } from "lucide-react";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime, getLatestInventory, summarizeInventory } from "@/lib/inventory";

export default function DashboardPage() {
  const latestInventory = getLatestInventory();
  const summary = summarizeInventory(latestInventory);
  const differentItems = latestInventory?.items.filter((item) => item.difference !== 0) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Resumen de inventario"
        description="Vista rapida del ultimo inventario fisico comparado con FUDO."
      />

      <section className="grid cols-4">
        <article className="card metric">
          <div>
            <p className="muted">Productos revisados</p>
            <p className="metric-value">{summary.totalProducts}</p>
          </div>
          <span className="icon-pill">
            <PackageCheck size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Con diferencias</p>
            <p className="metric-value">{summary.productsWithDifferences}</p>
          </div>
          <span className="icon-pill">
            <AlertTriangle size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Diferencias positivas</p>
            <p className="metric-value">{summary.positiveDifferences}</p>
          </div>
          <span className="icon-pill">
            <TrendingUp size={22} />
          </span>
        </article>
        <article className="card metric">
          <div>
            <p className="muted">Diferencias negativas</p>
            <p className="metric-value">{summary.negativeDifferences}</p>
          </div>
          <span className="icon-pill">
            <TrendingDown size={22} />
          </span>
        </article>
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

        <article className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Productos con diferencia</p>
              <h2>Revision prioritaria</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {differentItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>{item.category}</td>
                    <td>
                      <DifferenceBadge value={item.difference} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}
