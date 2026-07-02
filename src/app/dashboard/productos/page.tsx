"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  createCategory,
  createProduct,
  deleteProductRecord,
  listCategories,
  listProducts,
  loadCurrentUser,
  updateProductRecord
} from "@/lib/repositories";
import { Category, Product } from "@/lib/types";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

const emptyProduct: Omit<Product, "id"> = {
  name: "",
  category: "",
  categoryId: "",
  unit: "Unidades",
  price: 0,
  active: true
};

const unitOptions = ["Unidades", "KG", "Lts"];

type ImportRow = {
  name: string;
  category: string;
  price: number;
  rowNumber: number;
};

type IgnoredImportRow = {
  rowNumber: number;
  reason: string;
};

type ImportPreview = {
  sheetName: string;
  totalRows: number;
  rows: ImportRow[];
  newProducts: ImportRow[];
  updatedProducts: ImportRow[];
  newCategories: string[];
  ignoredRows: IgnoredImportRow[];
};

type ImportResult = {
  totalDetected: number;
  createdProducts: number;
  updatedProducts: number;
  createdCategories: number;
  ignoredProducts: number;
  errors: ImportError[];
  elapsedSeconds: number;
};

type BulkDeleteFailure = {
  productName: string;
  reason: string;
};

type ExcelWorksheet = Record<string, { v?: unknown } | string | undefined>;
type ImportPhase = "idle" | "categories" | "products" | "done";

type ImportProgress = {
  phase: ImportPhase;
  processedProducts: number;
  totalProducts: number;
  currentBatch: number;
  totalBatches: number;
  createdProducts: number;
  updatedProducts: number;
  createdCategories: number;
  errors: ImportError[];
};

type ImportError = {
  itemName: string;
  reason: string;
};

const productImportBatchSize = 50;
const categoryImportBatchSize = 25;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [message, setMessage] = useState("Cargando productos...");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkDeleteFailures, setBulkDeleteFailures] = useState<BulkDeleteFailure[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const productNameIndex = useMemo(() => {
    return new Map(products.map((product) => [normalizeKey(product.name), product]));
  }, [products]);

  const categoryNameIndex = useMemo(() => {
    return new Map(allCategories.map((category) => [normalizeKey(category.name), category]));
  }, [allCategories]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeKey(searchTerm);

    return products.filter((product) => {
      const matchesName = !normalizedSearch || normalizeKey(product.name).includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === "todas" ||
        (categoryFilter === "sin-categoria" && !product.categoryId) ||
        product.categoryId === categoryFilter;

      return matchesName && matchesCategory;
    });
  }, [categoryFilter, products, searchTerm]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.has(product.id)),
    [products, selectedProductIds]
  );

  const allFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every((product) => selectedProductIds.has(product.id));

  async function loadProducts() {
    try {
      setLoading(true);
      const [loadedProducts, loadedCategories, loadedAllCategories, currentUser] = await Promise.all([
        listProducts(),
        listCategories({ activeOnly: true }),
        listCategories(),
        loadCurrentUser()
      ]);
      setProducts(loadedProducts);
      setCategories(loadedCategories);
      setAllCategories(loadedAllCategories);
      setIsAdmin(currentUser.role === "admin");
      setMessage("Productos cargados.");
    } catch (error) {
      console.error("Error al cargar productos", error);
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los productos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function addProduct() {
    if (!form.name.trim() || !form.categoryId || !form.unit.trim()) {
      setMessage("Completa nombre, categoria y unidad de medida.");
      return;
    }
    const selectedCategory = categories.find((category) => category.id === form.categoryId);

    try {
      const createdProduct = await createProduct({
        name: form.name.trim(),
        category: selectedCategory?.name ?? "Sin categoria",
        categoryId: form.categoryId,
        unit: form.unit,
        price: Number(form.price) || 0,
        active: form.active
      });
      setProducts((current) => [...current, createdProduct].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setForm(emptyProduct);
      setMessage("Producto guardado correctamente.");
    } catch (error) {
      console.error("Error al crear producto", error);
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
        category: product.category,
        categoryId: product.categoryId,
        unit: product.unit,
        price: Number(product.price) || 0,
        active: product.active
      });
      setMessage("Producto guardado correctamente.");
    } catch (error) {
      console.error("Error al guardar producto", error);
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setSavingId(null);
    }
  }

  function normalizeKey(value: string) {
    return value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function parsePrice(value: unknown) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value ?? "")
      .replace(/\$/g, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getCellValue(worksheet: ExcelWorksheet, rowIndex: number, columnIndex: number) {
    const xlsxRowNumber = rowIndex + 1;
    const address = `${String.fromCharCode(65 + columnIndex)}${xlsxRowNumber}`;
    const cell = worksheet[address];

    return typeof cell === "object" ? cell.v ?? "" : "";
  }

  function getWorksheetRange(worksheet: ExcelWorksheet, xlsx: typeof import("xlsx")) {
    const reference = worksheet["!ref"];

    if (typeof reference !== "string") {
      return null;
    }

    return xlsx.utils.decode_range(reference);
  }

  function chunkItems<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }

  function waitForUiUpdate() {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }

  async function readImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const xlsx = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames.find((name) => normalizeKey(name) === "productos");

      if (!sheetName) {
        throw new Error('El archivo no contiene una hoja llamada "Productos".');
      }

      const worksheet = workbook.Sheets[sheetName] as ExcelWorksheet;
      const range = getWorksheetRange(worksheet, xlsx);
      const parsedRows: ImportRow[] = [];
      const ignoredRows: IgnoredImportRow[] = [];

      if (!range) {
        setImportPreview({
          sheetName,
          totalRows: 0,
          rows: [],
          newProducts: [],
          updatedProducts: [],
          newCategories: [],
          ignoredRows: []
        });
        setImportResult(null);
        setMessage("Vista previa lista: la hoja Productos esta vacia.");
        return;
      }

      for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
        const rowNumber = rowIndex + 1;
        const name = String(getCellValue(worksheet, rowIndex, 4)).trim();
        const category = String(getCellValue(worksheet, rowIndex, 1)).trim();
        const price = parsePrice(getCellValue(worksheet, rowIndex, 6));

        if (normalizeKey(name) === "nombre") {
          ignoredRows.push({
            rowNumber,
            reason: "Fila de encabezado."
          });
          continue;
        }

        if (!name) {
          ignoredRows.push({
            rowNumber,
            reason: "Nombre vacio."
          });
          continue;
        }

        parsedRows.push({
          name,
          category: category || "Sin categoria",
          price,
          rowNumber
        });
      }

      const totalRows = range.e.r - range.s.r + 1;

      const newCategories = Array.from(
        new Set(parsedRows.map((row) => row.category).filter((category) => !categoryNameIndex.has(normalizeKey(category))))
      );
      const previewProductIndex = new Map(productNameIndex);
      const newProducts: ImportRow[] = [];
      const updatedProducts: ImportRow[] = [];

      parsedRows.forEach((row) => {
        const key = normalizeKey(row.name);

        if (previewProductIndex.has(key)) {
          updatedProducts.push(row);
        } else {
          newProducts.push(row);
          previewProductIndex.set(key, {
            id: `preview-${row.rowNumber}`,
            name: row.name,
            category: row.category,
            categoryId: null,
            unit: "Unidades",
            price: row.price,
            active: true
          });
        }
      });

      setImportPreview({
        sheetName,
        totalRows,
        rows: parsedRows,
        newProducts,
        updatedProducts,
        newCategories,
        ignoredRows
      });
      setImportResult(null);
      setImportProgress(null);
      setMessage(`Vista previa lista: ${parsedRows.length} productos validos en la hoja ${sheetName}.`);
    } catch (error) {
      console.error("Error al leer Excel", error);
      setMessage(error instanceof Error ? error.message : "No se pudo leer el archivo Excel.");
    }
  }

  async function importExcelRows() {
    if (!importPreview) {
      return;
    }

    const startedAt = performance.now();
    const totalProductBatches = Math.max(1, Math.ceil(importPreview.rows.length / productImportBatchSize));

    try {
      setImporting(true);
      setImportResult(null);
      setImportProgress({
        phase: "categories",
        processedProducts: 0,
        totalProducts: importPreview.rows.length,
        currentBatch: 0,
        totalBatches: totalProductBatches,
        createdProducts: 0,
        updatedProducts: 0,
        createdCategories: 0,
        errors: []
      });
      setMessage("Importando, no cierres esta ventana...");

      let nextCategories = [...categories];
      let nextAllCategories = [...allCategories];
      const nextCategoryIndex = new Map(categoryNameIndex);
      const nextProductIndex = new Map(productNameIndex);
      let createdCategories = 0;
      let createdProducts = 0;
      let updatedProducts = 0;
      const errors: ImportError[] = [];

      const categoryBatches = chunkItems(importPreview.newCategories, categoryImportBatchSize);

      for (let batchIndex = 0; batchIndex < categoryBatches.length; batchIndex += 1) {
        const categoryBatch = categoryBatches[batchIndex];

        setImportProgress((current) =>
          current
            ? {
                ...current,
                phase: "categories",
                currentBatch: batchIndex + 1,
                totalBatches: categoryBatches.length
              }
            : current
        );
        setMessage(`Importando categorias: lote ${batchIndex + 1} de ${categoryBatches.length}.`);

        const categoryResults = await Promise.allSettled(
          categoryBatch.map(async (categoryName) => {
            const createdCategory = await createCategory({ name: categoryName, active: true });
            return createdCategory;
          })
        );

        categoryResults.forEach((result, index) => {
          const categoryName = categoryBatch[index];

          if (result.status === "fulfilled") {
            const createdCategory = result.value;
            nextCategories = [...nextCategories, createdCategory];
            nextAllCategories = [...nextAllCategories, createdCategory];
            nextCategoryIndex.set(normalizeKey(createdCategory.name), createdCategory);
            createdCategories += 1;
          } else {
            errors.push({
              itemName: categoryName,
              reason: result.reason instanceof Error ? result.reason.message : "No se pudo crear la categoria."
            });
          }
        });

        setImportProgress((current) =>
          current
            ? {
                ...current,
                createdCategories,
                errors: [...errors]
              }
            : current
        );
        await waitForUiUpdate();
      }

      const nextProducts = [...products];
      const productBatches = chunkItems(importPreview.rows, productImportBatchSize);

      for (let batchIndex = 0; batchIndex < productBatches.length; batchIndex += 1) {
        const productBatch = productBatches[batchIndex];

        setImportProgress((current) =>
          current
            ? {
                ...current,
                phase: "products",
                currentBatch: batchIndex + 1,
                totalBatches: productBatches.length
              }
            : current
        );
        setMessage(`Importando ${Math.min(batchIndex * productImportBatchSize + productBatch.length, importPreview.rows.length)} de ${importPreview.rows.length} productos...`);

        for (const row of productBatch) {
          try {
            const category = nextCategoryIndex.get(normalizeKey(row.category));
            const existingProduct = nextProductIndex.get(normalizeKey(row.name));
            const key = normalizeKey(row.name);

            if (existingProduct) {
              await updateProductRecord(existingProduct.id, {
                category: category?.name ?? row.category,
                categoryId: category?.id ?? null,
                price: row.price
              });

              const updatedProduct = {
                ...existingProduct,
                category: category?.name ?? row.category,
                categoryId: category?.id ?? null,
                price: row.price
              };

              const existingIndex = nextProducts.findIndex((product) => normalizeKey(product.name) === key);

              if (existingIndex >= 0) {
                nextProducts[existingIndex] = updatedProduct;
              }

              nextProductIndex.set(key, updatedProduct);
              updatedProducts += 1;
              continue;
            }

            const createdProduct = await createProduct({
              name: row.name,
              category: category?.name ?? row.category,
              categoryId: category?.id ?? null,
              unit: "Unidades",
              price: row.price,
              active: true
            });

            nextProducts.push(createdProduct);
            nextProductIndex.set(key, createdProduct);
            createdProducts += 1;
          } catch (error) {
            errors.push({
              itemName: row.name,
              reason: error instanceof Error ? error.message : "No se pudo importar el producto."
            });
          }
        }

        setImportProgress((current) =>
          current
            ? {
                ...current,
                processedProducts: Math.min((batchIndex + 1) * productImportBatchSize, importPreview.rows.length),
                createdProducts,
                updatedProducts,
                createdCategories,
                errors: [...errors]
              }
            : current
        );
        await waitForUiUpdate();
      }

      setCategories(nextCategories.sort((a, b) => a.name.localeCompare(b.name, "es")));
      setAllCategories(nextAllCategories.sort((a, b) => a.name.localeCompare(b.name, "es")));
      setProducts(nextProducts.sort((a, b) => a.name.localeCompare(b.name, "es")));
      setImportPreview(null);
      setImportProgress((current) =>
        current
          ? {
              ...current,
              phase: "done",
              currentBatch: productBatches.length,
              totalBatches: productBatches.length,
              processedProducts: importPreview.rows.length,
              createdProducts,
              updatedProducts,
              createdCategories,
              errors: [...errors]
            }
          : current
      );
      setImportResult({
        totalDetected: importPreview.rows.length,
        createdProducts,
        updatedProducts,
        createdCategories,
        ignoredProducts: importPreview.ignoredRows.length,
        errors,
        elapsedSeconds: Math.round(((performance.now() - startedAt) / 1000) * 10) / 10
      });
      setMessage(
        `Importación finalizada. Creados: ${createdProducts}. Actualizados: ${updatedProducts}. Categorias creadas: ${createdCategories}. Errores: ${errors.length}.`
      );
    } catch (error) {
      console.error("Error al importar Excel", error);
      setMessage(error instanceof Error ? error.message : "No se pudo importar el Excel.");
    } finally {
      setImporting(false);
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
      console.error("Error al eliminar producto", error);
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el producto.");
    }
  }

  function toggleProductSelection(id: string, checked: boolean) {
    setSelectedProductIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function setFilteredProductsSelection(checked: boolean) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      filteredProducts.forEach((product) => {
        if (checked) {
          next.add(product.id);
        } else {
          next.delete(product.id);
        }
      });
      return next;
    });
  }

  function clearSelectedProducts() {
    setSelectedProductIds(new Set());
  }

  async function deleteSelectedProducts() {
    if (selectedProducts.length === 0) {
      setMessage("Selecciona al menos un producto para eliminar.");
      return;
    }

    const confirmed = window.confirm(`¿Seguro que deseas eliminar ${selectedProducts.length} productos?`);

    if (!confirmed) {
      return;
    }

    const deletedIds: string[] = [];
    const failures: BulkDeleteFailure[] = [];

    for (const product of selectedProducts) {
      try {
        await deleteProductRecord(product.id);
        deletedIds.push(product.id);
      } catch (error) {
        failures.push({
          productName: product.name,
          reason: error instanceof Error ? error.message : "No se pudo eliminar."
        });
      }
    }

    setProducts((current) => current.filter((product) => !deletedIds.includes(product.id)));
    setSelectedProductIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    setBulkDeleteFailures(failures);
    setMessage(
      failures.length > 0
        ? `Eliminados: ${deletedIds.length}. No se pudieron eliminar: ${failures.length}.`
        : `Eliminados ${deletedIds.length} productos correctamente.`
    );
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
              <select
                onChange={(event) => {
                  const selectedCategory = categories.find((category) => category.id === event.target.value);
                  setForm({ ...form, categoryId: event.target.value, category: selectedCategory?.name ?? "" });
                }}
                value={form.categoryId ?? ""}
              >
                <option value="">Seleccionar categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Unidad de medida
              <select onChange={(event) => setForm({ ...form, unit: event.target.value })} value={form.unit}>
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Precio
              <input
                min="0"
                onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
                type="number"
                value={form.price}
              />
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
            {isAdmin ? (
              <label className="btn secondary" style={{ margin: 0 }}>
                Importar Excel
                <input accept=".xls,.xlsx" hidden onChange={readImportFile} type="file" />
              </label>
            ) : null}
          </div>
        </article>

        <article className="card">
          <h2>Estado del catalogo</h2>
          <p className="metric-value">{products.length}</p>
          <p className="muted">productos registrados</p>
          <span className="badge positive">{products.filter((product) => product.active).length} activos</span>
        </article>
      </section>

      {importPreview ? (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="section-title">
            <div>
              <h2>Vista previa de importacion</h2>
              <p className="muted">
                Hoja {importPreview.sheetName}: {importPreview.rows.length} productos validos, {importPreview.newProducts.length} nuevos,{" "}
                {importPreview.updatedProducts.length} productos se actualizaran.
              </p>
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={() => setImportPreview(null)} type="button">
                Cancelar
              </button>
              <button className="btn" disabled={importing || importPreview.rows.length === 0} onClick={importExcelRows} type="button">
                {importing ? "Importando, no cierres esta ventana..." : "Importar ahora"}
              </button>
            </div>
          </div>
          {importPreview.ignoredRows.length > 0 ? (
            <div className="helper-box" style={{ marginBottom: 14 }}>
              <strong>Productos ignorados:</strong>
              <br />
              {importPreview.ignoredRows.map((row) => `Fila ${row.rowNumber}: ${row.reason}`).join(" | ")}
            </div>
          ) : null}
          <div className="mobile-meta-grid">
            <span>Hoja leida</span>
            <strong>{importPreview.sheetName}</strong>
            <span>Total de filas</span>
            <strong>{importPreview.totalRows}</strong>
            <span>Productos validos</span>
            <strong>{importPreview.rows.length}</strong>
            <span>Productos nuevos</span>
            <strong>
              {importPreview.newProducts.length}
              {importPreview.newProducts.length > 0
                ? ` (${importPreview.newProducts.map((row) => row.name).slice(0, 5).join(", ")})`
                : ""}
            </strong>
            <span>Se actualizaran</span>
            <strong>
              {importPreview.updatedProducts.length}
              {importPreview.updatedProducts.length > 0
                ? ` (${importPreview.updatedProducts.map((row) => row.name).slice(0, 5).join(", ")})`
                : ""}
            </strong>
            <span>Categorias nuevas</span>
            <strong>
              {importPreview.newCategories.length}
              {importPreview.newCategories.length > 0 ? ` (${importPreview.newCategories.slice(0, 8).join(", ")})` : ""}
            </strong>
            <span>Productos ignorados</span>
            <strong>{importPreview.ignoredRows.length}</strong>
          </div>
        </section>
      ) : null}

      {importProgress ? (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="section-title">
            <div>
              <h2>{importProgress.phase === "done" ? "Importación finalizada" : "Importando, no cierres esta ventana..."}</h2>
              <p className="muted">
                {importProgress.phase === "categories"
                  ? `Creando categorias: lote ${importProgress.currentBatch} de ${importProgress.totalBatches}.`
                  : `Importando ${importProgress.processedProducts} de ${importProgress.totalProducts} productos. Lote ${importProgress.currentBatch} de ${importProgress.totalBatches}.`}
              </p>
            </div>
            <span className="badge neutral">{importProgress.errors.length} errores</span>
          </div>
          <div className="mobile-meta-grid">
            <span>Productos creados</span>
            <strong>{importProgress.createdProducts}</strong>
            <span>Productos actualizados</span>
            <strong>{importProgress.updatedProducts}</strong>
            <span>Categorias creadas</span>
            <strong>{importProgress.createdCategories}</strong>
            <span>Errores</span>
            <strong>{importProgress.errors.length}</strong>
          </div>
          {importProgress.errors.length > 0 ? (
            <div className="helper-box" style={{ marginTop: 14 }}>
              <strong>Errores detectados:</strong>
              <br />
              {importProgress.errors
                .slice(0, 12)
                .map((error) => `${error.itemName}: ${error.reason}`)
                .join(" | ")}
            </div>
          ) : null}
        </section>
      ) : null}

      {importResult ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Importación finalizada</h2>
          <div className="mobile-meta-grid">
            <span>Total detectados</span>
            <strong>{importResult.totalDetected}</strong>
            <span>Productos creados</span>
            <strong>{importResult.createdProducts}</strong>
            <span>Productos actualizados</span>
            <strong>{importResult.updatedProducts}</strong>
            <span>Categorias creadas</span>
            <strong>{importResult.createdCategories}</strong>
            <span>Productos ignorados</span>
            <strong>{importResult.ignoredProducts}</strong>
            <span>Errores</span>
            <strong>{importResult.errors.length}</strong>
            <span>Tiempo total</span>
            <strong>{importResult.elapsedSeconds} s</strong>
          </div>
          {importResult.errors.length > 0 ? (
            <div className="helper-box" style={{ marginTop: 14 }}>
              <strong>Resumen de errores:</strong>
              <br />
              {importResult.errors.map((error) => `${error.itemName}: ${error.reason}`).join(" | ")}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <div>
            <h2>Listado editable</h2>
            <p className="muted">
              {filteredProducts.length} visibles de {products.length}. Cada fila se guarda en Supabase al presionar el boton de guardar.
            </p>
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
              {allCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isAdmin ? (
          <div className="actions" style={{ marginBottom: 18 }}>
            <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                checked={allFilteredSelected}
                onChange={(event) => setFilteredProductsSelection(event.target.checked)}
                style={{ width: 18, minHeight: 18 }}
                type="checkbox"
              />
              Seleccionar todo
            </label>
            <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                checked={selectedProductIds.size === 0}
                onChange={(event) => {
                  if (event.target.checked) {
                    clearSelectedProducts();
                  }
                }}
                style={{ width: 18, minHeight: 18 }}
                type="checkbox"
              />
              Deseleccionar todo
            </label>
            <button className="btn ghost" disabled={selectedProductIds.size === 0} onClick={deleteSelectedProducts} type="button">
              <Trash2 size={17} />
              Eliminar seleccionados
            </button>
          </div>
        ) : null}
        {bulkDeleteFailures.length > 0 ? (
          <div className="helper-box" style={{ marginBottom: 18 }}>
            <strong>No se pudieron eliminar:</strong>
            <br />
            {bulkDeleteFailures.map((failure) => `${failure.productName}: ${failure.reason}`).join(" | ")}
          </div>
        ) : null}
        <div className="mobile-card-list">
          {filteredProducts.map((product) => (
            <article className="mobile-record-card" key={product.id}>
              <div className="mobile-record-header">
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {isAdmin ? (
                    <input
                      aria-label={`Seleccionar ${product.name}`}
                      checked={selectedProductIds.has(product.id)}
                      onChange={(event) => toggleProductSelection(product.id, event.target.checked)}
                      style={{ flex: "0 0 auto", width: 18, minHeight: 18 }}
                      type="checkbox"
                    />
                  ) : null}
                  <div>
                    <h3>{product.name || "Producto sin nombre"}</h3>
                    <p className="muted">{product.category || "Sin categoria"}</p>
                  </div>
                </div>
                <span className={`badge ${product.active ? "positive" : "neutral"}`}>
                  {product.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="form-grid">
                <label className="field">
                  Nombre
                  <input
                    onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                    value={product.name}
                  />
                </label>
                <label className="field">
                  Categoria
                  <select
                    onChange={(event) => {
                      const selectedCategory = categories.find((category) => category.id === event.target.value);
                      updateProduct(product.id, {
                        categoryId: event.target.value || null,
                        category: selectedCategory?.name ?? "Sin categoria"
                      });
                    }}
                    value={product.categoryId ?? ""}
                  >
                    <option value="">Sin categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Unidad
                  <select onChange={(event) => updateProduct(product.id, { unit: event.target.value })} value={product.unit}>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Precio
                  <input
                    min="0"
                    onChange={(event) => updateProduct(product.id, { price: Number(event.target.value) })}
                    type="number"
                    value={product.price}
                  />
                </label>
                <label className="field">
                  Estado
                  <select
                    onChange={(event) => updateProduct(product.id, { active: event.target.value === "true" })}
                    value={String(product.active)}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </label>
              </div>
              <div className="actions mobile-actions">
                <button
                  className="btn secondary"
                  disabled={savingId === product.id}
                  onClick={() => saveProduct(product)}
                  type="button"
                >
                  <Save size={17} />
                  Guardar
                </button>
                <button className="btn ghost" onClick={() => deleteProduct(product)} type="button">
                  <Trash2 size={17} />
                  Eliminar
                </button>
              </div>
            </article>
          ))}
          {!loading && filteredProducts.length === 0 ? (
            <article className="mobile-record-card">
              <p className="muted">No hay productos que coincidan con los filtros seleccionados.</p>
            </article>
          ) : null}
        </div>

        <div className="table-wrap desktop-table">
          <table>
            <thead>
              <tr>
                {isAdmin ? <th>Seleccionar</th> : null}
                <th>Nombre</th>
                <th>Categoria</th>
                <th>Unidad</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  {isAdmin ? (
                    <td>
                      <input
                        aria-label={`Seleccionar ${product.name}`}
                        checked={selectedProductIds.has(product.id)}
                        onChange={(event) => toggleProductSelection(product.id, event.target.checked)}
                        style={{ width: 18, minHeight: 18 }}
                        type="checkbox"
                      />
                    </td>
                  ) : null}
                  <td>
                    <input
                      onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                      value={product.name}
                    />
                  </td>
                  <td>
                    <select
                      onChange={(event) => {
                        const selectedCategory = categories.find((category) => category.id === event.target.value);
                        updateProduct(product.id, {
                          categoryId: event.target.value || null,
                          category: selectedCategory?.name ?? "Sin categoria"
                        });
                      }}
                      value={product.categoryId ?? ""}
                    >
                      <option value="">Sin categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select onChange={(event) => updateProduct(product.id, { unit: event.target.value })} value={product.unit}>
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      min="0"
                      onChange={(event) => updateProduct(product.id, { price: Number(event.target.value) })}
                      type="number"
                      value={product.price}
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
              {!loading && filteredProducts.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={isAdmin ? 7 : 6}>
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
