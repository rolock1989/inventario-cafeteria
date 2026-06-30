"use client";

import { Save, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createInventoryRows } from "@/lib/inventory";
import { loadCurrentUser, listCategories, listProducts, submitInventoryRecord } from "@/lib/repositories";
import { AppUser, Category, InventoryItem } from "@/lib/types";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { useEffect, useMemo, useState } from "react";

export default function InventoryPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState("Cargando inventario...");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadInventoryData() {
      try {
        const [user, products, loadedCategories] = await Promise.all([
          loadCurrentUser(),
          listProducts({ activeOnly: true }),
          listCategories({ activeOnly: true })
        ]);
        setCurrentUser(user);
        setRows(createInventoryRows(products));
        setCategories(loadedCategories);
        setStatus(`Inventario de ${user.name}`);
      } catch (error) {
        console.error("Error al cargar inventario", error);
        setStatus(error instanceof Error ? error.message : "No se pudo cargar el inventario.");
      }
    }

    loadInventoryData();
  }, []);

  const visibleRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesName = !normalizedSearch || row.productName.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === "todas" ||
        (categoryFilter === "sin-categoria" && !row.categoryId) ||
        row.categoryId === categoryFilter;

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
    setStatus("Borrador guardado en esta pantalla. El guardado persistente de borradores queda preparado para una siguiente etapa.");
  }

  async function submitInventory() {
    if (!currentUser) {
      setStatus("No hay usuario activo para enviar el inventario.");
      return;
    }

    if (rows.length === 0) {
      setStatus("No hay productos activos para enviar.");
      return;
    }

    try {
      setSubmitting(true);
      await submitInventoryRecord(currentUser, rows);
      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          physicalStock: 0,
          fudoStock: 0,
          difference: 0,
          comment: ""
        }))
      );
      setStatus("Inventario enviado y guardado correctamente.");
    } catch (error) {
      console.error("Error al enviar inventario", error);
      setStatus(error instanceof Error ? error.message : "No se pudo enviar el inventario.");
    } finally {
      setSubmitting(false);
    }
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
            <button className="btn secondary" disabled={submitting} onClick={saveDraft} type="button">
              <Save size={18} />
              Guardar borrador
            </button>
            <button className="btn" disabled={submitting || rows.length === 0} onClick={submitInventory} type="button">
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
              <option value="sin-categoria">Sin categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mobile-card-list inventory-mobile-list">
          {visibleRows.map((row) => (
            <article className="mobile-record-card" key={row.id}>
              <div className="mobile-record-header">
                <div>
                  <h3>{row.productName}</h3>
                  <p className="muted">{row.category}</p>
                </div>
                <DifferenceBadge value={row.difference} />
              </div>
              <div className="mobile-meta-grid">
                <span>Unidad</span>
                <strong>{row.unit}</strong>
              </div>
              <div className="form-grid mobile-inventory-fields">
                <label className="field">
                  Stock FUDO
                  <input
                    min="0"
                    onChange={(event) => updateRow(row.id, "fudoStock", event.target.value)}
                    type="number"
                    value={row.fudoStock}
                  />
                </label>
                <label className="field">
                  Stock fisico
                  <input
                    min="0"
                    onChange={(event) => updateRow(row.id, "physicalStock", event.target.value)}
                    type="number"
                    value={row.physicalStock}
                  />
                </label>
                <label className="field full">
                  Comentario
                  <input
                    onChange={(event) => updateRow(row.id, "comment", event.target.value)}
                    placeholder="Opcional"
                    value={row.comment}
                  />
                </label>
              </div>
            </article>
          ))}
          {visibleRows.length === 0 ? (
            <article className="mobile-record-card">
              <p className="muted">No hay productos que coincidan con la busqueda o categoria seleccionada.</p>
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
