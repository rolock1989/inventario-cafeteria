"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Area, Category } from "@/lib/types";
import {
  countProductsByCategory,
  createCategory,
  deleteCategoryRecord,
  listAreas,
  listCategories,
  moveCategoryProductsAndDelete,
  updateCategoryRecord
} from "@/lib/repositories";
import { useCallback, useEffect, useRef, useState } from "react";

const emptyCategory: Omit<Category, "id" | "createdAt"> = {
  name: "",
  active: true
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const selectedAreaIdRef = useRef("");
  const [form, setForm] = useState(emptyCategory);
  const [message, setMessage] = useState("Cargando categorias...");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [categoryToMove, setCategoryToMove] = useState<{ category: Category; productCount: number } | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [movingProducts, setMovingProducts] = useState(false);

  function pickDefaultArea(loadedAreas: Area[]) {
    return loadedAreas.find((area) => area.name.toLowerCase() === "cafetería")?.id ?? loadedAreas[0]?.id ?? "";
  }

  const loadCategories = useCallback(async (areaId?: string) => {
    try {
      setLoading(true);
      const loadedAreas = await listAreas({ activeOnly: true });
      const nextAreaId = areaId || selectedAreaIdRef.current || pickDefaultArea(loadedAreas);
      setAreas(loadedAreas);
      setSelectedAreaId(nextAreaId);
      selectedAreaIdRef.current = nextAreaId;
      setCategories(await listCategories({ areaId: nextAreaId }));
      setMessage("Categorias cargadas.");
    } catch (error) {
      console.error("Error al cargar categorias", error);
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las categorias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function changeArea(areaId: string) {
    setCategoryToMove(null);
    setTargetCategoryId("");
    await loadCategories(areaId);
  }

  async function addCategory() {
    if (!selectedAreaId || !form.name.trim()) {
      setMessage("Selecciona area y completa el nombre de la categoria.");
      return;
    }

    try {
      const createdCategory = await createCategory({
        name: form.name.trim(),
        areaId: selectedAreaId,
        active: form.active
      });
      setCategories((current) => [...current, createdCategory].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setForm(emptyCategory);
      setMessage("Categoria guardada correctamente.");
    } catch (error) {
      console.error("Error al crear categoria", error);
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la categoria.");
    }
  }

  function updateCategory(id: string, patch: Partial<Category>) {
    setCategories((current) => current.map((category) => (category.id === id ? { ...category, ...patch } : category)));
  }

  async function saveCategory(category: Category) {
    try {
      setSavingId(category.id);
      const savedCategory = await updateCategoryRecord(category.id, {
        name: category.name.trim(),
        areaId: selectedAreaId,
        active: category.active
      });
      setCategories((current) => current.map((item) => (item.id === category.id ? savedCategory : item)));
      setMessage("Categoria guardada correctamente.");
    } catch (error) {
      console.error("Error al guardar categoria", error);
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la categoria.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteCategory(category: Category) {
    const confirmed = window.confirm(`Eliminar la categoria "${category.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      const productCount = await countProductsByCategory(category.id);

      if (productCount > 0) {
        setCategoryToMove({ category, productCount });
        setTargetCategoryId("");
        setMessage(
          `No se puede eliminar "${category.name}" porque ${productCount} productos la utilizan. Muevelos a otra categoria para continuar.`
        );
        return;
      }

      await deleteCategoryRecord(category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setMessage("Categoria eliminada correctamente.");
    } catch (error) {
      console.error("Error al eliminar categoria", error);
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar la categoria.");
    }
  }

  async function moveProductsAndDeleteCategory() {
    if (!categoryToMove) {
      return;
    }

    if (!targetCategoryId) {
      setMessage("Selecciona una categoria de destino.");
      return;
    }

    try {
      setMovingProducts(true);
      await moveCategoryProductsAndDelete(categoryToMove.category.id, targetCategoryId);
      setCategories((current) => current.filter((item) => item.id !== categoryToMove.category.id));
      setCategoryToMove(null);
      setTargetCategoryId("");
      setMessage("Productos movidos y categoria eliminada correctamente.");
    } catch (error) {
      console.error("Error al mover productos y eliminar categoria", error);
      setMessage(error instanceof Error ? error.message : "No se pudo mover los productos y eliminar la categoria.");
    } finally {
      setMovingProducts(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administracion"
        title="Categorias"
        description="Crea categorias una sola vez y usalas en el catalogo de productos."
        action={<span className="badge neutral">{message}</span>}
      />

      <section className="card" style={{ marginBottom: 18 }}>
        <label className="field">
          Área
          <select onChange={(event) => changeArea(event.target.value)} value={selectedAreaId}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid cols-2">
        <article className="card">
          <h2>Crear categoria</h2>
          <div className="form-grid">
            <label className="field">
              Nombre
              <input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
            </label>
            <label className="field">
              Estado
              <select
                onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}
                value={String(form.active)}
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </label>
            <button className="btn" disabled={loading} onClick={addCategory} type="button">
              <Plus size={18} />
              Crear categoria
            </button>
          </div>
        </article>

        <article className="card">
          <h2>Estado de categorias</h2>
          <p className="metric-value">{categories.length}</p>
          <p className="muted">categorias registradas</p>
          <span className="badge positive">{categories.filter((category) => category.active).length} activas</span>
        </article>
      </section>

      {categoryToMove ? (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="section-title">
            <div>
              <h2>Mover productos antes de eliminar</h2>
              <p className="muted">
                {categoryToMove.productCount} productos usan &quot;{categoryToMove.category.name}&quot;. Selecciona una categoria de destino.
              </p>
            </div>
            <button
              className="btn ghost"
              onClick={() => {
                setCategoryToMove(null);
                setTargetCategoryId("");
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
          <div className="form-grid">
            <label className="field">
              Categoria de destino
              <select onChange={(event) => setTargetCategoryId(event.target.value)} value={targetCategoryId}>
                <option value="">Seleccionar categoria</option>
                {categories
                  .filter((category) => category.id !== categoryToMove.category.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <button className="btn" disabled={movingProducts || !targetCategoryId} onClick={moveProductsAndDeleteCategory} type="button">
              <Trash2 size={18} />
              Mover y eliminar
            </button>
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <div>
            <h2>Listado editable</h2>
            <p className="muted">No se pueden eliminar categorias con productos asociados.</p>
          </div>
        </div>

        <div className="mobile-card-list">
          {categories.map((category) => (
            <article className="mobile-record-card" key={category.id}>
              <div className="mobile-record-header">
                <div>
                  <h3>{category.name || "Categoria sin nombre"}</h3>
                  <p className="muted">{category.active ? "Activa" : "Inactiva"}</p>
                </div>
                <span className={`badge ${category.active ? "positive" : "neutral"}`}>
                  {category.active ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div className="form-grid">
                <label className="field">
                  Nombre
                  <input
                    onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                    value={category.name}
                  />
                </label>
                <label className="field">
                  Estado
                  <select
                    onChange={(event) => updateCategory(category.id, { active: event.target.value === "true" })}
                    value={String(category.active)}
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </label>
              </div>
              <div className="actions mobile-actions">
                <button
                  className="btn secondary"
                  disabled={savingId === category.id}
                  onClick={() => saveCategory(category)}
                  type="button"
                >
                  <Save size={17} />
                  Guardar
                </button>
                <button className="btn ghost" onClick={() => deleteCategory(category)} type="button">
                  <Trash2 size={17} />
                  Eliminar
                </button>
              </div>
            </article>
          ))}
          {!loading && categories.length === 0 ? (
            <article className="mobile-record-card">
              <p className="muted">No hay categorias registradas.</p>
            </article>
          ) : null}
        </div>

        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <input
                      onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                      value={category.name}
                    />
                  </td>
                  <td>
                    <select
                      onChange={(event) => updateCategory(category.id, { active: event.target.value === "true" })}
                      value={String(category.active)}
                    >
                      <option value="true">Activa</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn secondary"
                        disabled={savingId === category.id}
                        onClick={() => saveCategory(category)}
                        type="button"
                      >
                        <Save size={17} />
                      </button>
                      <button className="btn ghost" onClick={() => deleteCategory(category)} type="button">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && categories.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={3}>
                    No hay categorias registradas.
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
