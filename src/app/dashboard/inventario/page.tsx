"use client";

import { Save, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createInventoryRows, getActiveProducts, getCurrentUser, getUniqueCategories } from "@/lib/inventory";
import { InventoryItem } from "@/lib/types";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { useEffect, useMemo, useState } from "react";

export default function InventoryPage() {
  const currentUser = getCurrentUser();
  const [rows, setRows] = useState<InventoryItem[]>(() => createInventoryRows(getActiveProducts()));
  const [status, setStatus] = useState("Borrador sin guardar");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");

  useEffect(() => {
    setStatus(`Inventario de ${getCurrentUser().name}`);
  }, []);

  const categoryOptions = useMemo(() => getUniqueCategories(rows), [rows]);
  const visibleRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesName = !normalizedSearch || row.productName.toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === "todas" || row.category === categoryFilter;

      return matchesName && matchesCategory;
    });
  }, [categoryFilter, rows, searchTerm]);

  const totals = useMemo(
    () => ({
      products: visibleRows.length,
      differences: visibleRows.filter((row) => row.difference !== 0).length
    }),
    [visibleRows]
  );

  function updateRow(id: string, field: "physicalStock" | "fudoStock" | "comment", value: string) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) {
          return row;
        }

        const nextRow = {
          ...row,
          [field]: field === "comment" ? value : Number(value)
        };

        return {
          ...nextRow,
          difference: nextRow.physicalStock - nextRow.fudoStock
        };
      })
    );
  }

  function saveDraft() {
    setStatus(`Borrador guardado para ${currentUser.name}`);
  }

  function submitInventory() {
    setStatus(`Inventario enviado por ${currentUser.name}. En la siguiente etapa se guardara en Supabase.`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Registro semanal"
        title="Ingresar inventario"
        description="Completa stock fisico y stock FUDO. La diferencia se calcula automaticamente."
        action={<span className="badge neutral">{status}</span>}
      />

      <section className="card">
        <div className="section-title">
          <div>
            <h2>Productos activos</h2>
            <p className="muted">
              {totals.products} productos visibles, {totals.differences} con diferencias.
            </p>
          </div>
          <div className="actions">
            <button className="btn secondary" onClick={saveDraft} type="button">
              <Save size={18} />
              Guardar borrador
            </button>
            <button className="btn" onClick={submitInventory} type="button">
              <Send size={18} />
              Enviar inventario
            </button>
          </div>
        </div>

        <div className="form-grid" style={{ marginBottom: 18 }}>
          <label className="field">
            Buscar producto
            <input
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ej: cafe, leche, vasos"
              type="search"
              value={searchTerm}
            />
          </label>
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
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Unidad</th>
                <th>Stock fisico</th>
                <th>Stock FUDO</th>
                <th>Diferencia</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.productName}</td>
                  <td>{row.category}</td>
                  <td>{row.unit}</td>
                  <td>
                    <input
                      min="0"
                      onChange={(event) => updateRow(row.id, "physicalStock", event.target.value)}
                      type="number"
                      value={row.physicalStock}
                    />
                  </td>
                  <td>
                    <input
                      min="0"
                      onChange={(event) => updateRow(row.id, "fudoStock", event.target.value)}
                      type="number"
                      value={row.fudoStock}
                    />
                  </td>
                  <td>
                    <DifferenceBadge value={row.difference} />
                  </td>
                  <td>
                    <input
                      onChange={(event) => updateRow(row.id, "comment", event.target.value)}
                      placeholder="Opcional"
                      value={row.comment}
                    />
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={7}>
                    No hay productos que coincidan con la busqueda o categoria seleccionada.
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
