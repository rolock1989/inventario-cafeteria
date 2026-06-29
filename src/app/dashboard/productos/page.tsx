"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getProducts } from "@/lib/inventory";
import { Product } from "@/lib/types";
import { useState } from "react";

const emptyProduct: Omit<Product, "id"> = {
  name: "",
  category: "",
  unit: "",
  active: true
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(getProducts());
  const [form, setForm] = useState(emptyProduct);

  function addProduct() {
    if (!form.name || !form.category || !form.unit) {
      return;
    }

    setProducts((current) => [
      ...current,
      {
        ...form,
        id: `prd-${Date.now()}`
      }
    ]);
    setForm(emptyProduct);
  }

  function updateProduct(id: string, patch: Partial<Product>) {
    setProducts((current) => current.map((product) => (product.id === id ? { ...product, ...patch } : product)));
  }

  function deleteProduct(id: string) {
    setProducts((current) => current.filter((product) => product.id !== id));
  }

  return (
    <>
      <PageHeader
        eyebrow="Administracion"
        title="Productos"
        description="Mantencion del catalogo que se usa en los inventarios semanales."
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
            <button className="btn" onClick={addProduct} type="button">
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
            <p className="muted">Los cambios quedan en memoria hasta conectar la base de datos.</p>
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
                      <button className="btn secondary" type="button">
                        <Save size={17} />
                      </button>
                      <button className="btn ghost" onClick={() => deleteProduct(product.id)} type="button">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
