"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createProduct, deleteProductRecord, listProducts, updateProductRecord } from "@/lib/repositories";
import { Product } from "@/lib/types";
import { useEffect, useState } from "react";

const emptyProduct: Omit<Product, "id"> = {
  name: "",
  category: "",
  unit: "",
  active: true
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [message, setMessage] = useState("Cargando productos...");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadProducts() {
    try {
      setLoading(true);
      setProducts(await listProducts());
      setMessage("Productos cargados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function addProduct() {
    if (!form.name.trim() || !form.category.trim() || !form.unit.trim()) {
      setMessage("Completa nombre, categoria y unidad de medida.");
      return;
    }

    try {
      const createdProduct = await createProduct({
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim(),
        active: form.active
      });
      setProducts((current) => [...current, createdProduct].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setForm(emptyProduct);
      setMessage("Producto guardado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    }
  }

  function updateProduct(id: string, patch: Partial<Product>) {
    setProducts((current) => current.map((product) => (product.id === id ? { ...product, ...patch } : product)));
  }

  async function saveProduct(product: Product) {
    try {
      setSavingId(product.id);
      await updateProductRecord(product.id, {
        name: product.name.trim(),
        category: product.category.trim(),
        unit: product.unit.trim(),
        active: product.active
      });
      setMessage("Producto guardado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(`Eliminar el producto "${product.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteProductRecord(product.id);
      setProducts((current) => current.filter((currentProduct) => currentProduct.id !== product.id));
      setMessage("Producto eliminado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el producto.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administracion"
        title="Productos"
        description="Catalogo persistente para los inventarios semanales."
        action={<span className="badge neutral">{message}</span>}
      />

      <section className="grid cols-2">
        <article className="card">
          <h2>Crear producto</h2>
          <div className="form-grid">
            <label className="field">
              Nombre
              <input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
            </label>
            <label className="field">
              Categoria
              <input onChange={(event) => setForm({ ...form, category: event.target.value })} value={form.category} />
            </label>
            <label className="field">
              Unidad de medida
              <input onChange={(event) => setForm({ ...form, unit: event.target.value })} value={form.unit} />
            </label>
            <label className="field">
              Estado
              <select
                onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}
                value={String(form.active)}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            <button className="btn" disabled={loading} onClick={addProduct} type="button">
              <Plus size={18} />
              Crear producto
            </button>
          </div>
        </article>

        <article className="card">
          <h2>Estado del catalogo</h2>
          <p className="metric-value">{products.length}</p>
          <p className="muted">productos registrados</p>
          <span className="badge positive">{products.filter((product) => product.active).length} activos</span>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <div>
            <h2>Listado editable</h2>
            <p className="muted">Cada fila se guarda en Supabase al presionar el boton de guardar.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoria</th>
                <th>Unidad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <input
                      onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                      value={product.name}
                    />
                  </td>
                  <td>
                    <input
                      onChange={(event) => updateProduct(product.id, { category: event.target.value })}
                      value={product.category}
                    />
                  </td>
                  <td>
                    <input
                      onChange={(event) => updateProduct(product.id, { unit: event.target.value })}
                      value={product.unit}
                    />
                  </td>
                  <td>
                    <select
                      onChange={(event) => updateProduct(product.id, { active: event.target.value === "true" })}
                      value={String(product.active)}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn secondary"
                        disabled={savingId === product.id}
                        onClick={() => saveProduct(product)}
                        type="button"
                      >
                        <Save size={17} />
                      </button>
                      <button className="btn ghost" onClick={() => deleteProduct(product)} type="button">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && products.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={5}>
                    No hay productos registrados.
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
