import { mockInventories, mockProducts } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { startDevMeasurement } from "@/lib/dev-performance";
import {
  AppUser,
  Area,
  Category,
  DashboardMetrics,
  DashboardTopMissingItem,
  InventoryItem,
  InventoryListRecord,
  InventoryPage,
  InventoryRecord,
  Product,
  UserRole
} from "@/lib/types";
import { assertActiveUser, getFreshAuthSession } from "@/lib/auth";

type AreaRow = {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
};

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  category_id: string | null;
  categories?: Pick<CategoryRow, "id" | "name" | "active"> | Pick<CategoryRow, "id" | "name" | "active">[] | null;
  area_id: string | null;
  areas?: Pick<AreaRow, "id" | "name" | "active"> | Pick<AreaRow, "id" | "name" | "active">[] | null;
  unit: string;
  price: number | null;
  active: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  area_id: string | null;
  areas?: Pick<AreaRow, "id" | "name" | "active"> | Pick<AreaRow, "id" | "name" | "active">[] | null;
  active: boolean;
  created_at?: string;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  area_id: string | null;
  areas?: Pick<AreaRow, "id" | "name" | "active"> | Pick<AreaRow, "id" | "name" | "active">[] | null;
  active: boolean;
};

type InventorySessionRow = {
  id: string;
  status: "draft" | "submitted";
  user_id: string | null;
  user_name: string;
  user_email?: string | null;
  area_id: string | null;
  areas?: Pick<AreaRow, "id" | "name" | "active"> | Pick<AreaRow, "id" | "name" | "active">[] | null;
  shift: string;
  created_at: string;
  submitted_at: string | null;
  profiles?: Pick<ProfileRow, "name" | "email"> | Pick<ProfileRow, "name" | "email">[] | null;
  inventory_items?: InventoryItemRow[];
};

type InventoryItemRow = {
  id: string;
  inventory_session_id: string;
  product_id?: string | null;
  product_name?: string;
  category?: string;
  unit?: string;
  unit_price_at_time: number | null;
  loss_amount: number | null;
  physical_stock: number;
  fudo_stock: number;
  difference: number;
  comment?: string | null;
};

type DashboardMetricsRpcRow = {
  inventories?: number;
  total_products?: number;
  products_with_differences?: number;
  total_loss?: number;
  available_start_date?: string | null;
  available_end_date?: string | null;
  latest_inventory?: {
    id: string;
    submitted_at: string;
    user_name: string;
    area_id?: string | null;
    area_name?: string | null;
    shift: string;
    total_loss?: number;
  } | null;
  top_missing?: Array<{
    key: string;
    product_name: string;
    category: string;
    unit: string;
    area_id?: string | null;
    area_name?: string | null;
    missing_quantity: number;
    total_loss?: number;
  }>;
};

type InventoryHistoryRpcRow = {
  records?: Array<{
    id: string;
    submitted_at: string;
    user_name: string;
    area_id?: string | null;
    area_name?: string | null;
    shift: string;
    total_products?: number;
    products_with_differences?: number;
    total_difference?: number;
    total_loss?: number;
  }>;
  total?: number;
  has_more?: boolean;
  user_names?: string[];
};

type SupabaseQueryError = {
  code?: string;
  message: string;
};

type SupabaseQueryResult<T> = {
  data: T | null;
  error: SupabaseQueryError | null;
  count?: number | null;
};

const INVENTORY_PAGE_SIZE = 20;
const SUPABASE_BATCH_SIZE = 1000;

function isTransientQueryError(error: SupabaseQueryError) {
  return /fetch|network|timeout|timed out|connection|503|502|504/i.test(error.message);
}

function queryErrorMessage(context: string, error: SupabaseQueryError) {
  if (error.code === "PGRST301" || /jwt|token|session/i.test(error.message)) {
    return "Tu sesion expiro. Inicia sesion nuevamente.";
  }

  return `${context}: ${error.message}`;
}

async function runQueryWithRetry<T>(
  operation: () => PromiseLike<SupabaseQueryResult<T>>,
  context: string
): Promise<SupabaseQueryResult<T>> {
  let lastError: SupabaseQueryError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result: SupabaseQueryResult<T>;

    try {
      result = await operation();
    } catch (error) {
      lastError = { message: error instanceof Error ? error.message : "Error de conexion." };

      if (!isTransientQueryError(lastError) || attempt === 1) {
        break;
      }

      await new Promise((resolve) => globalThis.setTimeout(resolve, 300));
      continue;
    }

    if (!result.error) {
      return result;
    }

    lastError = result.error;

    if (!isTransientQueryError(result.error) || attempt === 1) {
      break;
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, 300));
  }

  throw new Error(queryErrorMessage(context, lastError ?? { message: "Error desconocido." }));
}

export function usingSupabase() {
  return Boolean(isSupabaseConfigured && supabase);
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase no esta configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return supabase;
}

function requirePersistence() {
  if (!usingSupabase()) {
    throw new Error("No se puede guardar porque Supabase no esta configurado. No se simulo ningun cambio.");
  }
}

function mapProduct(row: ProductRow): Product {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;

  return {
    id: row.id,
    name: row.name,
    category: category?.name ?? row.category ?? "Sin categoria",
    categoryId: row.category_id ?? category?.id ?? null,
    areaId: row.area_id ?? area?.id ?? null,
    areaName: area?.name ?? null,
    unit: row.unit,
    price: Number(row.price ?? 0),
    active: row.active
  };
}

function mapArea(row: AreaRow): Area {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at
  };
}

function mapCategory(row: CategoryRow): Category {
  const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;

  return {
    id: row.id,
    name: row.name,
    areaId: row.area_id ?? area?.id ?? null,
    areaName: area?.name ?? null,
    active: row.active,
    createdAt: row.created_at
  };
}

function mapProfile(row: ProfileRow): AppUser {
  const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    areaId: row.area_id ?? area?.id ?? null,
    areaName: area?.name ?? null,
    shift: "",
    active: row.active
  };
}

async function getAuthorizationHeaders() {
  const session = await getFreshAuthSession();

  if (!session?.access_token) {
    throw new Error("Debes iniciar sesion nuevamente.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`
  };
}

async function parseApiError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error ?? "Ocurrio un error al comunicarse con el servidor.";
}

function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    productId: row.product_id ?? "",
    productName: row.product_name ?? "",
    category: row.category ?? "",
    categoryId: null,
    unit: row.unit ?? "",
    unitPriceAtTime: Number(row.unit_price_at_time ?? 0),
    lossAmount: Number(row.loss_amount ?? 0),
    physicalStock: Number(row.physical_stock),
    fudoStock: Number(row.fudo_stock),
    difference: Number(row.difference),
    comment: row.comment ?? ""
  };
}

function mapInventory(row: InventorySessionRow): InventoryRecord {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? undefined,
    userId: row.user_id ?? "",
    userName: profile?.name ?? row.user_name,
    areaId: row.area_id ?? area?.id ?? null,
    areaName: area?.name ?? null,
    shift: row.shift,
    items: row.inventory_items?.map(mapInventoryItem) ?? []
  };
}

export async function listAreas(options: { activeOnly?: boolean } = {}) {
  requirePersistence();
  const client = requireSupabase();
  const result = await runQueryWithRetry<AreaRow[]>(() => {
    let query = client.from("areas").select("id,name,active,created_at").order("name");
    if (options.activeOnly) query = query.eq("active", true);
    return query;
  }, "No se pudieron cargar las areas");

  return (result.data ?? []).map(mapArea);
}

export async function listProducts(options: { activeOnly?: boolean; areaId?: string | null } = {}) {
  if (!usingSupabase()) {
    return options.activeOnly ? mockProducts.filter((product) => product.active) : mockProducts;
  }

  const client = requireSupabase();
  const result = await runQueryWithRetry<ProductRow[]>(() => {
    let query = client
      .from("products")
      .select("id,name,category,category_id,area_id,unit,price,active,categories(id,name,active),areas(id,name,active)")
      .order("name");
    if (options.activeOnly) query = query.eq("active", true);
    if (options.areaId) query = query.eq("area_id", options.areaId);
    return query;
  }, "No se pudieron cargar los productos");

  return (result.data ?? []).map(mapProduct);
}

export async function createProduct(input: Omit<Product, "id">) {
  requirePersistence();
  const categoryName = input.categoryId ? await getCategoryName(input.categoryId) : input.category;

  const { data, error } = await requireSupabase()
    .from("products")
    .insert({
      name: input.name,
      category: categoryName,
      category_id: input.categoryId || null,
      area_id: input.areaId || null,
      unit: input.unit,
      price: input.price,
      active: input.active
    })
    .select("id,name,category,category_id,area_id,unit,price,active,categories(id,name,active),areas(id,name,active)")
    .single();

  if (error) {
    throw new Error(`No se pudo crear el producto: ${error.message}`);
  }

  return mapProduct(data as ProductRow);
}

export async function updateProductRecord(id: string, patch: Partial<Omit<Product, "id">>) {
  requirePersistence();
  const nextPatch = { ...patch };

  if (Object.prototype.hasOwnProperty.call(nextPatch, "categoryId")) {
    nextPatch.category = nextPatch.categoryId ? await getCategoryName(nextPatch.categoryId) : "Sin categoria";
  }

  const { data, error } = await requireSupabase()
    .from("products")
    .update({
      name: nextPatch.name,
      category: nextPatch.category,
      category_id: nextPatch.categoryId,
      area_id: nextPatch.areaId,
      unit: nextPatch.unit,
      price: nextPatch.price,
      active: nextPatch.active,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    throw new Error(`No se pudo guardar el producto: ${error.message}`);
  }

  if (!data) {
    throw new Error("No se pudo guardar el producto: Supabase no devolvio la fila actualizada. Revisa permisos RLS.");
  }
}

export async function listCategories(options: { activeOnly?: boolean; areaId?: string | null } = {}) {
  requirePersistence();

  const client = requireSupabase();
  const result = await runQueryWithRetry<CategoryRow[]>(() => {
    let query = client
      .from("categories")
      .select("id,name,area_id,active,created_at,areas(id,name,active)")
      .order("name");
    if (options.activeOnly) query = query.eq("active", true);
    if (options.areaId) query = query.eq("area_id", options.areaId);
    return query;
  }, "No se pudieron cargar las categorias");

  return (result.data ?? []).map(mapCategory);
}

async function getCategoryName(categoryId: string) {
  const { data, error } = await requireSupabase().from("categories").select("name").eq("id", categoryId).single();

  if (error) {
    throw new Error(`No se pudo cargar la categoria: ${error.message}`);
  }

  return data.name as string;
}

export async function createCategory(input: Omit<Category, "id" | "createdAt">) {
  requirePersistence();

  const { data, error } = await requireSupabase()
    .from("categories")
    .insert({
      name: input.name,
      area_id: input.areaId || null,
      active: input.active
    })
    .select("id,name,area_id,active,created_at,areas(id,name,active)")
    .single();

  if (error) {
    throw new Error(`No se pudo crear la categoria: ${error.message}`);
  }

  return mapCategory(data as CategoryRow);
}

export async function updateCategoryRecord(id: string, patch: Partial<Omit<Category, "id" | "createdAt">>) {
  requirePersistence();

  const { data, error } = await requireSupabase()
    .from("categories")
    .update({
      name: patch.name,
      area_id: patch.areaId,
      active: patch.active
    })
    .eq("id", id)
    .select("id,name,area_id,active,created_at,areas(id,name,active)")
    .single();

  if (error) {
    throw new Error(`No se pudo guardar la categoria: ${error.message}`);
  }

  return mapCategory(data as CategoryRow);
}

export async function deleteCategoryRecord(id: string) {
  requirePersistence();

  const { count, error: countError } = await requireSupabase()
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (countError) {
    throw new Error(`No se pudo revisar si la categoria tiene productos: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    throw new Error("No se puede eliminar la categoria porque tiene productos asociados.");
  }

  const { data, error } = await requireSupabase().from("categories").delete().eq("id", id).select("id").single();

  if (error) {
    throw new Error(`No se pudo eliminar la categoria: ${error.message}`);
  }

  if (!data) {
    throw new Error("No se pudo eliminar la categoria. Revisa permisos RLS.");
  }
}

export async function countProductsByCategory(categoryId: string) {
  requirePersistence();

  const { count, error } = await requireSupabase()
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (error) {
    throw new Error(`No se pudo contar los productos de la categoria: ${error.message}`);
  }

  return count ?? 0;
}

export async function moveCategoryProductsAndDelete(categoryId: string, targetCategoryId: string) {
  requirePersistence();

  if (categoryId === targetCategoryId) {
    throw new Error("Selecciona una categoria de destino distinta.");
  }

  const targetCategoryName = await getCategoryName(targetCategoryId);
  const { data: categories, error: categoryError } = await requireSupabase()
    .from("categories")
    .select("id,area_id")
    .in("id", [categoryId, targetCategoryId]);

  if (categoryError) {
    throw new Error(`No se pudieron validar las categorias: ${categoryError.message}`);
  }

  const sourceCategory = categories?.find((category) => category.id === categoryId);
  const targetCategory = categories?.find((category) => category.id === targetCategoryId);

  if (!sourceCategory || !targetCategory || sourceCategory.area_id !== targetCategory.area_id) {
    throw new Error("La categoria de destino debe pertenecer a la misma area.");
  }

  const { error: moveError } = await requireSupabase()
    .from("products")
    .update({
      category: targetCategoryName,
      category_id: targetCategoryId,
      updated_at: new Date().toISOString()
    })
    .eq("category_id", categoryId);

  if (moveError) {
    throw new Error(`No se pudieron mover los productos: ${moveError.message}`);
  }

  await deleteCategoryRecord(categoryId);
}

export async function deleteProductRecord(id: string) {
  requirePersistence();

  const { data, error } = await requireSupabase().from("products").delete().eq("id", id).select("id").single();

  if (error) {
    throw new Error(`No se pudo eliminar el producto: ${error.message}`);
  }

  if (!data) {
    throw new Error("No se pudo eliminar el producto: Supabase no devolvio la fila eliminada. Revisa permisos RLS.");
  }
}

export async function listUsers(options: { activeOnly?: boolean } = {}) {
  requirePersistence();
  const client = requireSupabase();
  const result = await runQueryWithRetry<ProfileRow[]>(() => {
    let query = client
      .from("profiles")
      .select("id,name,email,role,area_id,active,areas(id,name,active)")
      .order("name");
    if (options.activeOnly) query = query.eq("active", true);
    return query;
  }, "No se pudieron cargar los usuarios");

  return (result.data ?? []).map(mapProfile);
}

export async function getProfileById(id: string) {
  requirePersistence();

  const client = requireSupabase();
  const result = await runQueryWithRetry<ProfileRow>(() =>
    client
      .from("profiles")
      .select("id,name,email,role,area_id,active,areas(id,name,active)")
      .eq("id", id)
      .single(),
  "No se pudo cargar el usuario");

  return mapProfile(result.data as ProfileRow);
}

export async function createUser(input: Omit<AppUser, "id"> & { password: string }) {
  requirePersistence();

  const response = await fetch("/api/users", {
    method: "POST",
    headers: await getAuthorizationHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`No se pudo crear el usuario: ${await parseApiError(response)}`);
  }

  const data = await response.json();
  return mapProfile(data.user as ProfileRow);
}

export async function updateUserRecord(id: string, patch: Partial<Omit<AppUser, "id">> & { password?: string }) {
  requirePersistence();

  const response = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: await getAuthorizationHeaders(),
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    throw new Error(`No se pudo guardar el usuario: ${await parseApiError(response)}`);
  }

  const data = await response.json();
  return mapProfile(data.user as ProfileRow);
}

export async function deleteUserRecord(id: string) {
  requirePersistence();

  const response = await fetch(`/api/users/${id}`, {
    method: "DELETE",
    headers: await getAuthorizationHeaders()
  });

  if (!response.ok) {
    throw new Error(`No se pudo eliminar el usuario: ${await parseApiError(response)}`);
  }
}

export async function loadCurrentUser(measurementContext = "current-user") {
  if (typeof window === "undefined") {
    throw new Error("No se pudo cargar el usuario actual en el servidor.");
  }

  const endTotal = startDevMeasurement(`${measurementContext} / usuario actual total`);
  const endAuth = startDevMeasurement(`${measurementContext} / autenticacion`);
  const session = await getFreshAuthSession();
  endAuth({ sessionAvailable: Boolean(session?.user) });

  if (!session?.user) {
    throw new Error("No hay sesion activa.");
  }

  const endProfile = startDevMeasurement(`${measurementContext} / perfil`);
  const user = await getProfileById(session.user.id);
  endProfile();
  assertActiveUser(user);
  endTotal();
  return user;
}

const inventoryHeaderSelect =
  "id,status,user_id,user_name,area_id,shift,created_at,submitted_at,areas(id,name,active)";
const inventoryItemSelect =
  "id,inventory_session_id,product_id,product_name,category,unit,unit_price_at_time,loss_amount,physical_stock,fudo_stock,difference,comment";

type InventoryQueryOptions = {
  areaId?: string | null;
  startDate?: string;
  endDate?: string;
  userName?: string;
};

function dateBoundary(value: string, endOfDay = false) {
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`).toISOString();
}

function filterMockInventories(records: InventoryRecord[], options: InventoryQueryOptions) {
  const startTime = options.startDate ? new Date(dateBoundary(options.startDate)).getTime() : null;
  const endTime = options.endDate ? new Date(dateBoundary(options.endDate, true)).getTime() : null;

  return records.filter((inventory) => {
    const submittedTime = new Date(inventory.submittedAt ?? inventory.createdAt).getTime();
    return (
      (!options.areaId || inventory.areaId === options.areaId) &&
      (!options.userName || inventory.userName === options.userName) &&
      (startTime === null || submittedTime >= startTime) &&
      (endTime === null || submittedTime <= endTime)
    );
  });
}

function chunkValues<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );
}

async function fetchInventoryItems(sessionIds: string[], measurementLabel = "inventarios / items") {
  if (sessionIds.length === 0) {
    return [] as InventoryItemRow[];
  }

  const endTotal = startDevMeasurement(`${measurementLabel} total`);
  const client = requireSupabase();
  const rows: InventoryItemRow[] = [];
  let requestCount = 0;

  for (const sessionIdBatch of chunkValues(sessionIds, 100)) {
    let offset = 0;

    while (true) {
      requestCount += 1;
      const endRequest = startDevMeasurement(`${measurementLabel} solicitud ${requestCount}`);
      const result = await runQueryWithRetry<InventoryItemRow[]>(
        () =>
          client
            .from("inventory_items")
            .select(inventoryItemSelect)
            .in("inventory_session_id", sessionIdBatch)
            .order("id")
            .range(offset, offset + SUPABASE_BATCH_SIZE - 1) as unknown as PromiseLike<SupabaseQueryResult<InventoryItemRow[]>>,
        "No se pudieron cargar los productos de los inventarios"
      );
      const batch = result.data ?? [];
      rows.push(...batch);
      endRequest({ rows: batch.length, sessions: sessionIdBatch.length });

      if (batch.length < SUPABASE_BATCH_SIZE) {
        break;
      }

      offset += SUPABASE_BATCH_SIZE;
    }
  }

  endTotal({ requests: requestCount, rows: rows.length, sessions: sessionIds.length });
  return rows;
}

function attachInventoryItems(sessionRows: InventorySessionRow[], itemRows: InventoryItemRow[]) {
  const itemsBySession = itemRows.reduce<Map<string, InventoryItemRow[]>>((grouped, item) => {
    const current = grouped.get(item.inventory_session_id) ?? [];
    current.push(item);
    grouped.set(item.inventory_session_id, current);
    return grouped;
  }, new Map());

  return sessionRows.map((row) => ({
    ...row,
    inventory_items: itemsBySession.get(row.id) ?? []
  }));
}

function mapInventoryListRecord(row: InventorySessionRow): InventoryListRecord {
  const inventory = mapInventory(row);
  const summary = inventory.items.reduce(
    (current, item) => ({
      totalProducts: current.totalProducts + 1,
      productsWithDifferences: current.productsWithDifferences + (item.difference !== 0 ? 1 : 0),
      totalDifference: current.totalDifference + item.difference,
      totalLoss:
        current.totalLoss +
        (item.lossAmount > 0
          ? item.lossAmount
          : item.physicalStock < item.fudoStock
            ? (item.fudoStock - item.physicalStock) * item.unitPriceAtTime
            : 0)
    }),
    { totalProducts: 0, productsWithDifferences: 0, totalDifference: 0, totalLoss: 0 }
  );

  const { items: _items, ...header } = inventory;
  return { ...header, ...summary };
}

function historicalItemLoss(item: InventoryItem) {
  if (Number.isFinite(item.lossAmount) && item.lossAmount > 0) return item.lossAmount;
  return item.physicalStock < item.fudoStock
    ? (item.fudoStock - item.physicalStock) * item.unitPriceAtTime
    : 0;
}

export async function getDashboardMetrics(options: InventoryQueryOptions = {}): Promise<DashboardMetrics> {
  if (!usingSupabase()) {
    const availableRecords = filterMockInventories(mockInventories, { areaId: options.areaId });
    const records = filterMockInventories(mockInventories, options)
      .sort((a, b) => new Date(b.submittedAt ?? b.createdAt).getTime() - new Date(a.submittedAt ?? a.createdAt).getTime());
    const topMissing = new Map<string, DashboardTopMissingItem>();
    let totalProducts = 0;
    let productsWithDifferences = 0;
    let totalLoss = 0;

    records.forEach((inventory) => {
      inventory.items.forEach((item) => {
        totalProducts += 1;
        productsWithDifferences += item.difference !== 0 ? 1 : 0;
        totalLoss += historicalItemLoss(item);

        if (item.physicalStock >= item.fudoStock) return;
        const key = `${inventory.areaId ?? "sin-area"}:${item.productId || `${item.productName}:${item.category}`}`;
        const current = topMissing.get(key);
        topMissing.set(key, {
          key,
          productName: item.productName,
          category: item.category,
          unit: item.unit,
          areaId: inventory.areaId,
          areaName: inventory.areaName,
          missingQuantity: (current?.missingQuantity ?? 0) + item.fudoStock - item.physicalStock,
          totalLoss: (current?.totalLoss ?? 0) + historicalItemLoss(item)
        });
      });
    });

    const availableTimes = availableRecords.map((record) => new Date(record.submittedAt ?? record.createdAt));
    const latest = records[0];
    return {
      inventories: records.length,
      totalProducts,
      productsWithDifferences,
      totalLoss,
      availableStartDate: availableTimes.length > 0 ? formatDateForRpc(new Date(Math.min(...availableTimes.map(Number)))) : undefined,
      availableEndDate: availableTimes.length > 0 ? formatDateForRpc(new Date(Math.max(...availableTimes.map(Number)))) : undefined,
      latestInventory: latest ? {
        id: latest.id,
        submittedAt: latest.submittedAt ?? latest.createdAt,
        userName: latest.userName,
        areaId: latest.areaId,
        areaName: latest.areaName,
        shift: latest.shift,
        totalLoss: latest.items.reduce((total, item) => total + historicalItemLoss(item), 0)
      } : undefined,
      topMissing: Array.from(topMissing.values())
        .sort((a, b) => b.missingQuantity - a.missingQuantity || a.key.localeCompare(b.key))
        .slice(0, 10)
    };
  }

  const endMeasurement = startDevMeasurement("dashboard / RPC get_dashboard_inventory_metrics");
  const result = await runQueryWithRetry<DashboardMetricsRpcRow>(() =>
    requireSupabase().rpc("get_dashboard_inventory_metrics", {
      p_start_date: options.startDate || null,
      p_end_date: options.endDate || null,
      p_area_id: options.areaId || null
    }) as unknown as PromiseLike<SupabaseQueryResult<DashboardMetricsRpcRow>>,
  "No se pudieron cargar las estadisticas del dashboard");
  const row = result.data ?? {};
  endMeasurement({ inventories: Number(row.inventories ?? 0), products: Number(row.total_products ?? 0) });

  return {
    inventories: Number(row.inventories ?? 0),
    totalProducts: Number(row.total_products ?? 0),
    productsWithDifferences: Number(row.products_with_differences ?? 0),
    ...(row.total_loss === undefined ? {} : { totalLoss: Number(row.total_loss) }),
    availableStartDate: row.available_start_date ?? undefined,
    availableEndDate: row.available_end_date ?? undefined,
    latestInventory: row.latest_inventory ? {
      id: row.latest_inventory.id,
      submittedAt: row.latest_inventory.submitted_at,
      userName: row.latest_inventory.user_name,
      areaId: row.latest_inventory.area_id,
      areaName: row.latest_inventory.area_name,
      shift: row.latest_inventory.shift,
      ...(row.latest_inventory.total_loss === undefined ? {} : { totalLoss: Number(row.latest_inventory.total_loss) })
    } : undefined,
    topMissing: (row.top_missing ?? []).map((item) => ({
      key: item.key,
      productName: item.product_name,
      category: item.category,
      unit: item.unit,
      areaId: item.area_id,
      areaName: item.area_name,
      missingQuantity: Number(item.missing_quantity),
      ...(item.total_loss === undefined ? {} : { totalLoss: Number(item.total_loss) })
    }))
  };
}

function formatDateForRpc(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function listInventorySummaries(
  options: InventoryQueryOptions & { page?: number; pageSize?: number } = {}
): Promise<InventoryPage> {
  const page = Math.max(0, options.page ?? 0);
  const pageSize = Math.max(1, options.pageSize ?? INVENTORY_PAGE_SIZE);

  if (!usingSupabase()) {
    const filtered = filterMockInventories(mockInventories, options);
    const userNames = Array.from(new Set(filterMockInventories(mockInventories, {
      areaId: options.areaId,
      startDate: options.startDate,
      endDate: options.endDate
    }).map((inventory) => inventory.userName))).sort((a, b) => a.localeCompare(b, "es"));
    const records = filtered
      .sort((a, b) => new Date(b.submittedAt ?? b.createdAt).getTime() - new Date(a.submittedAt ?? a.createdAt).getTime())
      .slice(page * pageSize, (page + 1) * pageSize)
      .map((inventory) => mapInventoryListRecord({
        id: inventory.id,
        status: inventory.status,
        user_id: inventory.userId,
        user_name: inventory.userName,
        user_email: null,
        area_id: inventory.areaId ?? null,
        shift: inventory.shift,
        created_at: inventory.createdAt,
        submitted_at: inventory.submittedAt ?? null,
        inventory_items: inventory.items.map((item) => ({
          id: item.id,
          inventory_session_id: inventory.id,
          product_id: item.productId,
          product_name: item.productName,
          category: item.category,
          unit: item.unit,
          unit_price_at_time: item.unitPriceAtTime,
          loss_amount: item.lossAmount,
          physical_stock: item.physicalStock,
          fudo_stock: item.fudoStock,
          difference: item.difference,
          comment: item.comment ?? null
        }))
      }));

    return { records, total: filtered.length, hasMore: (page + 1) * pageSize < filtered.length, userNames };
  }

  const endMeasurement = startDevMeasurement("historial / RPC get_inventory_history_page");
  const result = await runQueryWithRetry<InventoryHistoryRpcRow>(() =>
    requireSupabase().rpc("get_inventory_history_page", {
      p_start_date: options.startDate || null,
      p_end_date: options.endDate || null,
      p_area_id: options.areaId || null,
      p_user_name: options.userName || null,
      p_page: page,
      p_page_size: pageSize
    }) as unknown as PromiseLike<SupabaseQueryResult<InventoryHistoryRpcRow>>,
  "No se pudo cargar el historial");
  const row = result.data ?? {};
  const records: InventoryListRecord[] = (row.records ?? []).map((record) => ({
    id: record.id,
    status: "submitted",
    createdAt: record.submitted_at,
    submittedAt: record.submitted_at,
    userId: "",
    userName: record.user_name,
    areaId: record.area_id,
    areaName: record.area_name,
    shift: record.shift,
    totalProducts: Number(record.total_products ?? 0),
    productsWithDifferences: Number(record.products_with_differences ?? 0),
    totalDifference: Number(record.total_difference ?? 0),
    totalLoss: Number(record.total_loss ?? 0)
  }));
  const total = Number(row.total ?? 0);
  endMeasurement({ records: records.length, total, page });

  return {
    records,
    total,
    hasMore: Boolean(row.has_more),
    userNames: row.user_names ?? []
  };
}

export async function listInventories(options: InventoryQueryOptions = {}, measurementContext = "inventarios") {
  if (!usingSupabase()) {
    return filterMockInventories(mockInventories, options).sort((a, b) => {
      const aDate = a.submittedAt ?? a.createdAt;
      const bDate = b.submittedAt ?? b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  const client = requireSupabase();
  const sessionRows: InventorySessionRow[] = [];
  let offset = 0;
  let sessionRequestCount = 0;
  const endTotal = startDevMeasurement(`${measurementContext} / carga completa total`);

  while (true) {
    sessionRequestCount += 1;
    const endRequest = startDevMeasurement(`${measurementContext} / inventory_sessions solicitud ${sessionRequestCount}`);
    const result = await runQueryWithRetry<InventorySessionRow[]>(() => {
      let query = client
        .from("inventory_sessions")
        .select(inventoryHeaderSelect)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .range(offset, offset + 199);

      if (options.areaId) query = query.eq("area_id", options.areaId);
      if (options.startDate) query = query.gte("submitted_at", dateBoundary(options.startDate));
      if (options.endDate) query = query.lte("submitted_at", dateBoundary(options.endDate, true));
      if (options.userName) query = query.eq("user_name", options.userName);
      return query;
    }, "No se pudieron cargar los inventarios");
    const batch = result.data ?? [];
    endRequest({ rows: batch.length, offset });
    sessionRows.push(...batch);

    if (batch.length < 200) break;
    offset += 200;
  }

  const itemRows = await fetchInventoryItems(
    sessionRows.map((row) => row.id),
    `${measurementContext} / inventory_items completos`
  );
  const records = attachInventoryItems(sessionRows, itemRows).map(mapInventory);
  endTotal({ sessionRequests: sessionRequestCount, sessions: sessionRows.length, items: itemRows.length });
  return records;
}

export async function getActiveDraftInventory(userId: string, areaId?: string | null) {
  if (!usingSupabase()) {
    return undefined;
  }

  const client = requireSupabase();
  const result = await runQueryWithRetry<InventorySessionRow | null>(() => {
    let query = client
      .from("inventory_sessions")
      .select(inventoryHeaderSelect)
      .eq("status", "draft")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (areaId) query = query.eq("area_id", areaId);
    return query.maybeSingle();
  }, "No se pudo cargar el borrador");
  const data = result.data;

  if (!data) return undefined;

  const itemRows = await fetchInventoryItems([data.id]);
  return mapInventory({ ...(data as InventorySessionRow), inventory_items: itemRows });
}

export async function getInventoryRecord(id: string) {
  if (!usingSupabase()) {
    return mockInventories.find((inventory) => inventory.id === id);
  }

  const client = requireSupabase();
  const result = await runQueryWithRetry<InventorySessionRow>(() =>
    client
      .from("inventory_sessions")
      .select(inventoryHeaderSelect)
      .eq("id", id)
      .eq("status", "submitted")
      .single(),
  "No se pudo cargar el detalle del inventario");
  const data = result.data as InventorySessionRow;

  const itemRows = await fetchInventoryItems([data.id]);
  return mapInventory({ ...(data as InventorySessionRow), inventory_items: itemRows });
}

export async function deleteInventoryRecord(id: string) {
  requirePersistence();

  const response = await fetch(`/api/inventories/${id}`, {
    method: "DELETE",
    headers: await getAuthorizationHeaders()
  });

  if (!response.ok) {
    throw new Error(`No se pudo eliminar el inventario: ${await parseApiError(response)}`);
  }
}

export async function saveDraftInventoryRecord(user: AppUser, areaId: string, items: InventoryItem[], draftId?: string) {
  requirePersistence();

  const response = await fetch("/api/inventories/draft", {
    method: "POST",
    headers: await getAuthorizationHeaders(),
    body: JSON.stringify({
      draftId,
      areaId,
      shift: user.shift || "Sin turno",
      items
    })
  });

  if (!response.ok) {
    throw new Error(`No se pudo guardar el borrador: ${await parseApiError(response)}`);
  }

  const data = await response.json();
  return data.draftId as string;
}

export async function submitDraftInventoryRecord(user: AppUser, areaId: string, draftId: string, items: InventoryItem[]) {
  requirePersistence();

  const response = await fetch("/api/inventories/draft", {
    method: "PATCH",
    headers: await getAuthorizationHeaders(),
    body: JSON.stringify({
      draftId,
      areaId,
      shift: user.shift || "Sin turno",
      items
    })
  });

  if (!response.ok) {
    throw new Error(`No se pudo enviar el borrador: ${await parseApiError(response)}`);
  }
}

export async function discardDraftInventoryRecord(draftId: string, areaId?: string) {
  requirePersistence();

  const response = await fetch("/api/inventories/draft", {
    method: "DELETE",
    headers: await getAuthorizationHeaders(),
    body: JSON.stringify({ draftId, areaId })
  });

  if (!response.ok) {
    throw new Error(`No se pudo descartar el borrador: ${await parseApiError(response)}`);
  }
}

export async function submitInventoryRecord(user: AppUser, areaId: string, items: InventoryItem[]) {
  requirePersistence();

  const client = requireSupabase();
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await client
    .from("inventory_sessions")
    .insert({
      status: "submitted",
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      area_id: areaId,
      shift: user.shift || "Sin turno",
      submitted_at: now
    })
    .select("id")
    .single();

  if (sessionError) {
    throw new Error(`No se pudo guardar el inventario: ${sessionError.message}`);
  }

  const rows = items.map((item) => ({
    inventory_session_id: session.id,
    product_id: item.productId || null,
    product_name: item.productName,
    category: item.category,
    unit: item.unit,
    unit_price_at_time: item.unitPriceAtTime,
    loss_amount: item.lossAmount,
    physical_stock: item.physicalStock,
    fudo_stock: item.fudoStock,
    comment: item.comment || null
  }));

  const { error: itemsError } = await client.from("inventory_items").insert(rows);

  if (itemsError) {
    throw new Error(`No se pudo guardar el detalle del inventario: ${itemsError.message}`);
  }
}
