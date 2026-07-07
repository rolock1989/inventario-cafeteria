import { mockInventories, mockProducts } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AppUser, Area, Category, InventoryItem, InventoryRecord, Product, UserRole } from "@/lib/types";
import { assertActiveUser, getAuthSession, getFreshAuthSession } from "@/lib/auth";

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
  user_email: string | null;
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
  product_id: string | null;
  product_name: string;
  category: string;
  unit: string;
  unit_price_at_time: number | null;
  loss_amount: number | null;
  physical_stock: number;
  fudo_stock: number;
  difference: number;
  comment: string | null;
};

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
    productName: row.product_name,
    category: row.category,
    categoryId: null,
    unit: row.unit,
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

  let query = requireSupabase().from("areas").select("id,name,active,created_at").order("name");

  if (options.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar las areas: ${error.message}`);
  }

  return (data as AreaRow[]).map(mapArea);
}

export async function listProducts(options: { activeOnly?: boolean; areaId?: string | null } = {}) {
  if (!usingSupabase()) {
    return options.activeOnly ? mockProducts.filter((product) => product.active) : mockProducts;
  }

  let query = requireSupabase()
    .from("products")
    .select("id,name,category,category_id,area_id,unit,price,active,categories(id,name,active),areas(id,name,active)")
    .order("name");

  if (options.activeOnly) {
    query = query.eq("active", true);
  }

  if (options.areaId) {
    query = query.eq("area_id", options.areaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  }

  return (data as ProductRow[]).map(mapProduct);
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

  let query = requireSupabase()
    .from("categories")
    .select("id,name,area_id,active,created_at,areas(id,name,active)")
    .order("name");

  if (options.activeOnly) {
    query = query.eq("active", true);
  }

  if (options.areaId) {
    query = query.eq("area_id", options.areaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar las categorias: ${error.message}`);
  }

  return (data as CategoryRow[]).map(mapCategory);
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

  let query = requireSupabase()
    .from("profiles")
    .select("id,name,email,role,area_id,active,areas(id,name,active)")
    .order("name");

  if (options.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar los usuarios: ${error.message}`);
  }

  return (data as ProfileRow[]).map(mapProfile);
}

export async function getProfileById(id: string) {
  requirePersistence();

  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id,name,email,role,area_id,active,areas(id,name,active)")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`No se pudo cargar el usuario: ${error.message}`);
  }

  return mapProfile(data as ProfileRow);
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

export async function loadCurrentUser() {
  if (typeof window === "undefined") {
    throw new Error("No se pudo cargar el usuario actual en el servidor.");
  }

  const session = await getAuthSession();

  if (!session?.user) {
    throw new Error("No hay sesion activa.");
  }

  const user = await getProfileById(session.user.id);
  assertActiveUser(user);
  return user;
}

const inventorySelect =
  "id,status,user_id,user_name,user_email,area_id,shift,created_at,submitted_at,areas(id,name,active),profiles(name,email),inventory_items(id,inventory_session_id,product_id,product_name,category,unit,unit_price_at_time,loss_amount,physical_stock,fudo_stock,difference,comment)";

export async function listInventories(options: { areaId?: string | null } = {}) {
  if (!usingSupabase()) {
    return [...mockInventories].sort((a, b) => {
      const aDate = a.submittedAt ?? a.createdAt;
      const bDate = b.submittedAt ?? b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  let query = requireSupabase()
    .from("inventory_sessions")
    .select(inventorySelect)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });

  if (options.areaId) {
    query = query.eq("area_id", options.areaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No se pudo cargar el historial: ${error.message}`);
  }

  return (data as InventorySessionRow[]).map(mapInventory);
}

export async function getActiveDraftInventory(userId: string, areaId?: string | null) {
  if (!usingSupabase()) {
    return undefined;
  }

  let query = requireSupabase()
    .from("inventory_sessions")
    .select(inventorySelect)
    .eq("status", "draft")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (areaId) {
    query = query.eq("area_id", areaId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el borrador: ${error.message}`);
  }

  return data ? mapInventory(data as InventorySessionRow) : undefined;
}

export async function getInventoryRecord(id: string) {
  if (!usingSupabase()) {
    return mockInventories.find((inventory) => inventory.id === id);
  }

  const { data, error } = await requireSupabase()
    .from("inventory_sessions")
    .select(inventorySelect)
    .eq("id", id)
    .eq("status", "submitted")
    .single();

  if (error) {
    throw new Error(`No se pudo cargar el detalle del inventario: ${error.message}`);
  }

  return mapInventory(data as InventorySessionRow);
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
