"use client";

import { Save, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { createInventoryRows } from "@/lib/inventory";
import {
  discardDraftInventoryRecord,
  getActiveDraftInventory,
  listAreas,
  loadCurrentUser,
  listCategories,
  listProducts,
  saveDraftInventoryRecord,
  submitDraftInventoryRecord,
  submitInventoryRecord
} from "@/lib/repositories";
import { AppUser, Area, Category, InventoryItem, Product } from "@/lib/types";
import { DifferenceBadge } from "@/components/DifferenceBadge";
import { FocusEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type StockField = "physicalStock" | "fudoStock";
type StockDrafts = Record<string, Partial<Record<StockField, string>>>;
type MobileInventoryFilter = "todos" | "pendientes" | "diferencias";

function normalizeProductName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hydrateDraftRows(draftItems: InventoryItem[], activeProducts: Product[], allProducts: Product[]) {
  const productsById = new Map(allProducts.map((product) => [product.id, product]));
  const draftProductIds = new Set(draftItems.map((item) => item.productId).filter(Boolean));
  const draftProductNames = new Set(draftItems.map((item) => normalizeProductName(item.productName)));

  const hydratedRows = draftItems.map((item) => {
    const product = productsById.get(item.productId);

    return {
      ...item,
      categoryId: product?.categoryId ?? item.categoryId ?? null,
      productActive: product?.active ?? item.productActive ?? false
    };
  });

  const newProductRows = createInventoryRows(
    activeProducts.filter(
      (product) => !draftProductIds.has(product.id) && !draftProductNames.has(normalizeProductName(product.name))
    )
  );

  return {
    rows: [...hydratedRows, ...newProductRows],
    addedProductsCount: newProductRows.length
  };
}

function isUnavailableEmptyProduct(row: InventoryItem) {
  return (
    row.productActive === false &&
    row.physicalStock === 0 &&
    row.fudoStock === 0 &&
    row.difference === 0 &&
    !row.comment?.trim()
  );
}

export default function InventoryPage() {
  const stockInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [selectedAreaName, setSelectedAreaName] = useState("");
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [catalogRows, setCatalogRows] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState("Cargando inventario...");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [mobileInventoryFilter, setMobileInventoryFilter] = useState<MobileInventoryFilter>("todos");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftNoticeVisible, setDraftNoticeVisible] = useState(false);
  const [draftMergeMessage, setDraftMergeMessage] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [stockDrafts, setStockDrafts] = useState<StockDrafts>({});
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    async function loadInventoryForArea(user: AppUser, areaId: string, areaName: string) {
      const [products, loadedCategories] = await Promise.all([
        listProducts({ areaId }),
        listCategories({ activeOnly: true, areaId })
      ]);
      const activeProducts = products.filter((product) => product.active);
      const draft = await getActiveDraftInventory(user.id, areaId);
      const emptyRows = createInventoryRows(activeProducts);

      setCatalogRows(emptyRows);
      setCategories(loadedCategories);
      setSelectedAreaId(areaId);
      setSelectedAreaName(areaName);

      if (draft) {
        const hydratedDraft = hydrateDraftRows(draft.items, activeProducts, products);

        setDraftId(draft.id);
        setRows(hydratedDraft.rows);
        setDraftNoticeVisible(true);
        setDraftMergeMessage(
          hydratedDraft.addedProductsCount > 0
            ? `Se agregaron ${hydratedDraft.addedProductsCount} productos nuevos al borrador.`
            : ""
        );
        setStatus(
          hydratedDraft.addedProductsCount > 0
            ? `Se agregaron ${hydratedDraft.addedProductsCount} productos nuevos al borrador de ${areaName}.`
            : `Tienes un borrador pendiente en ${areaName}. Puedes continuar o descartarlo.`
        );
      } else {
        setDraftId(null);
        setRows(emptyRows);
        setDraftMergeMessage("");
        setDraftNoticeVisible(false);
        setStatus(`Inventario de ${user.name}. Área: ${areaName}`);
      }

      setStockDrafts({});
      setHasUnsavedChanges(false);
    }

    async function loadInventoryData() {
      try {
        const user = await loadCurrentUser();
        setCurrentUser(user);

        if (user.role === "admin") {
          const loadedAreas = await listAreas({ activeOnly: true });
          setAreas(loadedAreas);
          setRows([]);
          setCatalogRows([]);
          setStatus("Selecciona un área para comenzar el inventario.");
          return;
        }

        if (!user.areaId) {
          setStatus("Tu usuario no tiene un area asignada.");
          return;
        }

        await loadInventoryForArea(user, user.areaId, user.areaName ?? "Sin area");
      } catch (error) {
        console.error("Error al cargar inventario", error);
        setStatus(error instanceof Error ? error.message : "No se pudo cargar el inventario.");
      }
    }

    loadInventoryData();
  }, []);

  async function selectInventoryArea(areaId: string) {
    if (!currentUser) {
      return;
    }

    const area = areas.find((item) => item.id === areaId);

    if (!area) {
      setSelectedAreaId("");
      setSelectedAreaName("");
      setRows([]);
      setStatus("Selecciona un área para comenzar el inventario.");
      return;
    }

    try {
      setStatus(`Cargando inventario de ${area.name}...`);
      const [products, loadedCategories] = await Promise.all([
        listProducts({ areaId }),
        listCategories({ activeOnly: true, areaId })
      ]);
      const activeProducts = products.filter((product) => product.active);
      const draft = await getActiveDraftInventory(currentUser.id, areaId);
      const emptyRows = createInventoryRows(activeProducts);

      setCatalogRows(emptyRows);
      setCategories(loadedCategories);
      setSelectedAreaId(areaId);
      setSelectedAreaName(area.name);

      if (draft) {
        const hydratedDraft = hydrateDraftRows(draft.items, activeProducts, products);
        setDraftId(draft.id);
        setRows(hydratedDraft.rows);
        setDraftNoticeVisible(true);
        setDraftMergeMessage(
          hydratedDraft.addedProductsCount > 0
            ? `Se agregaron ${hydratedDraft.addedProductsCount} productos nuevos al borrador.`
            : ""
        );
        setStatus("Tienes un borrador pendiente. Puedes continuar o descartarlo.");
      } else {
        setDraftId(null);
        setRows(emptyRows);
        setDraftNoticeVisible(false);
        setDraftMergeMessage("");
        setStatus(`Inventario de ${currentUser.name}. Área: ${area.name}`);
      }

      setStockDrafts({});
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error al cambiar area de inventario", error);
      setStatus(error instanceof Error ? error.message : "No se pudo cargar el area seleccionada.");
    }
  }

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

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
  const mobileVisibleRows = useMemo(
    () =>
      visibleRows.filter((row) => {
        if (mobileInventoryFilter === "pendientes") {
          return row.physicalStock === 0 && row.fudoStock === 0 && row.difference === 0 && !row.comment?.trim();
        }

        if (mobileInventoryFilter === "diferencias") {
          return row.difference !== 0;
        }

        return true;
      }),
    [mobileInventoryFilter, visibleRows]
  );

  function acceptsDecimalStock(unit: string) {
    const normalizedUnit = unit.trim().toLowerCase();
    return normalizedUnit === "kg" || normalizedUnit === "lts" || normalizedUnit === "lt" || normalizedUnit.includes("litro");
  }

  function normalizeStockInput(value: string, row: InventoryItem) {
    const normalizedValue = value.replace(",", ".");

    if (normalizedValue === "") {
      return "";
    }

    const numericValue = Number(normalizedValue);

    if (!Number.isFinite(numericValue)) {
      return normalizedValue;
    }

    if (acceptsDecimalStock(row.unit)) {
      return normalizedValue;
    }

    return String(Math.trunc(numericValue));
  }

  function parseStockInput(value: string) {
    if (value === "") {
      return 0;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  function getStockInputValue(row: InventoryItem, field: StockField) {
    return stockDrafts[row.id]?.[field] ?? String(row[field]);
  }

  function handleStockFocus(event: FocusEvent<HTMLInputElement>) {
    if (event.currentTarget.value === "0") {
      event.currentTarget.select();
    }
  }

  function handleStockBlur(id: string, field: StockField) {
    setStockDrafts((currentDrafts) => {
      const currentValue = currentDrafts[id]?.[field];

      if (currentValue === undefined) {
        return currentDrafts;
      }

      const nextDrafts = { ...currentDrafts };
      const nextRowDraft = { ...nextDrafts[id] };
      delete nextRowDraft[field];

      if (Object.keys(nextRowDraft).length === 0) {
        delete nextDrafts[id];
      } else {
        nextDrafts[id] = nextRowDraft;
      }

      return nextDrafts;
    });
  }

  function stockInputKey(rowId: string, field: StockField) {
    return `${rowId}-${field}`;
  }

  function focusStockInput(rowId: string, field: StockField) {
    window.requestAnimationFrame(() => {
      stockInputRefs.current[stockInputKey(rowId, field)]?.focus();
      stockInputRefs.current[stockInputKey(rowId, field)]?.select();
    });
  }

  function handleMobileStockKeyDown(event: KeyboardEvent<HTMLInputElement>, row: InventoryItem, rowIndex: number, field: StockField) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (field === "fudoStock") {
      focusStockInput(row.id, "physicalStock");
      return;
    }

    const nextRow = mobileVisibleRows[rowIndex + 1];

    if (nextRow) {
      focusStockInput(nextRow.id, "fudoStock");
      return;
    }

    event.currentTarget.blur();
  }

  function updateStockRow(row: InventoryItem, field: StockField, value: string) {
    const nextValue = normalizeStockInput(value, row);
    const numericValue = parseStockInput(nextValue);

    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [row.id]: {
        ...currentDrafts[row.id],
        [field]: nextValue
      }
    }));

    setRows((currentRows) =>
      currentRows.map((currentRow) => {
        if (currentRow.id !== row.id) {
          return currentRow;
        }

        const nextRow = {
          ...currentRow,
          [field]: numericValue
        };

        return {
          ...nextRow,
          difference: nextRow.physicalStock - nextRow.fudoStock,
          lossAmount:
            nextRow.physicalStock < nextRow.fudoStock
              ? (nextRow.fudoStock - nextRow.physicalStock) * nextRow.unitPriceAtTime
              : 0
        };
      })
    );
    setHasUnsavedChanges(true);
  }

  function updateRow(id: string, field: "comment", value: string) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) {
          return row;
        }

        const nextRow = {
          ...row,
          [field]: value
        };

        return {
          ...nextRow,
          difference: nextRow.physicalStock - nextRow.fudoStock,
          lossAmount:
            nextRow.physicalStock < nextRow.fudoStock
              ? (nextRow.fudoStock - nextRow.physicalStock) * nextRow.unitPriceAtTime
              : 0
        };
      })
    );
    setHasUnsavedChanges(true);
  }

  async function saveDraft() {
    if (!currentUser || !selectedAreaId) {
      setStatus("Selecciona un area para guardar el borrador.");
      return;
    }

    try {
      setSavingDraft(true);
      const savedDraftId = await saveDraftInventoryRecord(currentUser, selectedAreaId, rows, draftId ?? undefined);
      setDraftId(savedDraftId);
      setDraftNoticeVisible(false);
      setDraftMergeMessage("");
      setHasUnsavedChanges(false);
      setStatus("Borrador guardado correctamente.");
    } catch (error) {
      console.error("Error al guardar borrador", error);
      setStatus(error instanceof Error ? error.message : "No se pudo guardar el borrador.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function discardDraft() {
    if (!draftId) {
      setRows(catalogRows);
      setDraftNoticeVisible(false);
      setDraftMergeMessage("");
      setHasUnsavedChanges(false);
      setStatus("Borrador descartado.");
      return;
    }

    const confirmed = window.confirm("Descartar este borrador?");

    if (!confirmed) {
      return;
    }

    try {
      await discardDraftInventoryRecord(draftId, selectedAreaId);
      setDraftId(null);
      setRows(catalogRows);
      setStockDrafts({});
      setDraftNoticeVisible(false);
      setDraftMergeMessage("");
      setHasUnsavedChanges(false);
      setStatus("Borrador descartado.");
    } catch (error) {
      console.error("Error al descartar borrador", error);
      setStatus(error instanceof Error ? error.message : "No se pudo descartar el borrador.");
    }
  }

  function continueDraft() {
    setDraftNoticeVisible(false);
    setDraftMergeMessage("");
    setStatus("Continuando borrador pendiente.");
  }

  async function submitInventory() {
    if (!currentUser || !selectedAreaId) {
      setStatus("Selecciona un area para enviar el inventario.");
      return;
    }

    if (rows.length === 0) {
      setStatus("No hay productos activos para enviar.");
      return;
    }

    try {
      setSubmitting(true);
      if (draftId) {
        await submitDraftInventoryRecord(currentUser, selectedAreaId, draftId, rows);
      } else {
        await submitInventoryRecord(currentUser, selectedAreaId, rows);
      }

      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          physicalStock: 0,
          fudoStock: 0,
          difference: 0,
          lossAmount: 0,
          comment: ""
        }))
      );
      setStockDrafts({});
      setDraftId(null);
      setDraftNoticeVisible(false);
      setDraftMergeMessage("");
      setHasUnsavedChanges(false);
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

      <section className="card" style={{ marginBottom: 18 }}>
        {isAdmin ? (
          <label className="field">
            Área
            <select onChange={(event) => selectInventoryArea(event.target.value)} value={selectedAreaId}>
              <option value="">Seleccionar área</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="badge neutral">Área: {selectedAreaName || currentUser?.areaName || "Sin area"}</span>
        )}
      </section>

      {draftNoticeVisible ? (
        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-title">
            <div>
              <h2>Borrador pendiente</h2>
              <p className="muted">Tienes un borrador pendiente. Puedes continuar o descartarlo.</p>
              {draftMergeMessage ? <p className="muted">{draftMergeMessage}</p> : null}
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={continueDraft} type="button">
                Continuar borrador
              </button>
              <button className="btn ghost" onClick={discardDraft} type="button">
                Descartar borrador
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card inventory-entry-card">
        <div className="section-title">
          <div>
            <h2>Productos activos</h2>
            <p className="muted">
              {totals.products} productos visibles, {totals.differences} con diferencias.
            </p>
          </div>
          <div className="actions desktop-inventory-actions">
            <button className="btn secondary" disabled={!selectedAreaId || submitting || savingDraft || rows.length === 0} onClick={saveDraft} type="button">
              <Save size={18} />
              {savingDraft ? "Guardando..." : "Guardar borrador"}
            </button>
            <button className="btn" disabled={!selectedAreaId || submitting || savingDraft || rows.length === 0} onClick={submitInventory} type="button">
              <Send size={18} />
              Enviar inventario
            </button>
          </div>
        </div>

        <div className="form-grid desktop-inventory-filters" style={{ marginBottom: 18 }}>
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

        <div className="mobile-inventory-workspace">
          <div className="mobile-inventory-toolbar">
            <label className="field">
              Buscar
              <input
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Producto"
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
            <label className="field full">
              Estado
              <select
                onChange={(event) => setMobileInventoryFilter(event.target.value as MobileInventoryFilter)}
                value={mobileInventoryFilter}
              >
                <option value="todos">Todos</option>
                <option value="pendientes">Pendientes</option>
                <option value="diferencias">Con diferencias</option>
              </select>
            </label>
          </div>

          <div className="mobile-inventory-actions">
            <button className="btn secondary" disabled={!selectedAreaId || submitting || savingDraft || rows.length === 0} onClick={saveDraft} type="button">
              <Save size={18} />
              {savingDraft ? "Guardando..." : "Guardar borrador"}
            </button>
            <button className="btn" disabled={!selectedAreaId || submitting || savingDraft || rows.length === 0} onClick={submitInventory} type="button">
              <Send size={18} />
              Enviar inventario
            </button>
          </div>

          <div className="mobile-card-list inventory-mobile-list">
            {mobileVisibleRows.map((row, rowIndex) => (
              <article className={`mobile-record-card inventory-compact-row ${isUnavailableEmptyProduct(row) ? "inventory-row-inactive" : ""}`} key={row.id}>
                <div className="inventory-compact-header">
                  <div className="inventory-compact-title">
                    <h3>
                      {row.productName} {row.productActive === false ? <span className="badge neutral">Inactivo</span> : null}
                    </h3>
                    <p className="muted">{row.category}</p>
                  </div>
                  <DifferenceBadge value={row.difference} />
                </div>
                <div className="inventory-compact-fields">
                  <label className="field">
                    Stock FUDO
                    <input
                      min="0"
                      onBlur={() => handleStockBlur(row.id, "fudoStock")}
                      onChange={(event) => updateStockRow(row, "fudoStock", event.target.value)}
                      onFocus={handleStockFocus}
                      onKeyDown={(event) => handleMobileStockKeyDown(event, row, rowIndex, "fudoStock")}
                      ref={(input) => {
                        stockInputRefs.current[stockInputKey(row.id, "fudoStock")] = input;
                      }}
                      inputMode={acceptsDecimalStock(row.unit) ? "decimal" : "numeric"}
                      step={acceptsDecimalStock(row.unit) ? "any" : "1"}
                      type="number"
                      value={getStockInputValue(row, "fudoStock")}
                    />
                  </label>
                  <label className="field">
                    Stock fisico
                    <input
                      min="0"
                      onBlur={() => handleStockBlur(row.id, "physicalStock")}
                      onChange={(event) => updateStockRow(row, "physicalStock", event.target.value)}
                      onFocus={handleStockFocus}
                      onKeyDown={(event) => handleMobileStockKeyDown(event, row, rowIndex, "physicalStock")}
                      ref={(input) => {
                        stockInputRefs.current[stockInputKey(row.id, "physicalStock")] = input;
                      }}
                      inputMode={acceptsDecimalStock(row.unit) ? "decimal" : "numeric"}
                      step={acceptsDecimalStock(row.unit) ? "any" : "1"}
                      type="number"
                      value={getStockInputValue(row, "physicalStock")}
                    />
                  </label>
                  <label className="field full inventory-compact-comment">
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
            {mobileVisibleRows.length === 0 ? (
              <article className="mobile-record-card inventory-compact-row">
                <p className="muted">No hay productos que coincidan con los filtros seleccionados.</p>
              </article>
            ) : null}
          </div>
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
                {isAdmin ? <th>Monto pérdida</th> : null}
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr className={isUnavailableEmptyProduct(row) ? "inventory-row-inactive" : undefined} key={row.id}>
                  <td>
                    {row.productName} {row.productActive === false ? <span className="badge neutral">Inactivo</span> : null}
                  </td>
                  <td>{row.category}</td>
                  <td>{row.unit}</td>
                  <td>
                    <input
                    min="0"
                      onBlur={() => handleStockBlur(row.id, "physicalStock")}
                      onChange={(event) => updateStockRow(row, "physicalStock", event.target.value)}
                      onFocus={handleStockFocus}
                      inputMode={acceptsDecimalStock(row.unit) ? "decimal" : "numeric"}
                      step={acceptsDecimalStock(row.unit) ? "any" : "1"}
                      type="number"
                      value={getStockInputValue(row, "physicalStock")}
                    />
                  </td>
                  <td>
                    <input
                      min="0"
                      onBlur={() => handleStockBlur(row.id, "fudoStock")}
                      onChange={(event) => updateStockRow(row, "fudoStock", event.target.value)}
                      onFocus={handleStockFocus}
                      inputMode={acceptsDecimalStock(row.unit) ? "decimal" : "numeric"}
                      step={acceptsDecimalStock(row.unit) ? "any" : "1"}
                      type="number"
                      value={getStockInputValue(row, "fudoStock")}
                    />
                  </td>
                  <td>
                    <DifferenceBadge value={row.difference} />
                  </td>
                  {isAdmin ? <td>${row.lossAmount.toLocaleString("es-CL")}</td> : null}
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
                  <td className="muted" colSpan={isAdmin ? 8 : 7}>
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
