import { mockInventories, mockProducts, mockUsers } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AppUser, InventoryItem, InventoryRecord, Product, UserRole } from "@/lib/types";

type ProductRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  shift: string | null;
  active: boolean;
};

type InventorySessionRow = {
  id: string;
  status: "draft" | "submitted";
  user_id: string | null;
  user_name: string;
  user_email: string | null;
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

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    active: row.active
  };
}

function mapProfile(row: ProfileRow): AppUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    shift: row.shift ?? "",
    active: row.active
  };
}

function mapInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    productId: row.product_id ?? "",
    productName: row.product_name,
    category: row.category,
    unit: row.unit,
    physicalStock: Number(row.physical_stock),
    fudoStock: Number(row.fudo_stock),
    difference: Number(row.difference),
    comment: row.comment ?? ""
  };
}

function mapInventory(row: InventorySessionRow): InventoryRecord {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? undefined,
    userId: row.user_id ?? "",
    userName: profile?.name ?? row.user_name,
    shift: row.shift,
    items: row.inventory_items?.map(mapInventoryItem) ?? []
  };
}

export async function listProducts(options: { activeOnly?: boolean } = {}) {
  if (!usingSupabase()) {
    return options.activeOnly ? mockProducts.filter((product) => product.active) : mockProducts;
  }

  let query = requireSupabase().from("products").select("id,name,category,unit,active").order("name");

  if (options.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  }

  return (data as ProductRow[]).map(mapProduct);
}

export async function createProduct(input: Omit<Product, "id">) {
  if (!usingSupabase()) {
    return { ...input, id: `prd-${Date.now()}` };
  }

  const { data, error } = await requireSupabase()
    .from("products")
    .insert({
      name: input.name,
      category: input.category,
      unit: input.unit,
      active: input.active
    })
    .select("id,name,category,unit,active")
    .single();

  if (error) {
    throw new Error(`No se pudo crear el producto: ${error.message}`);
  }

  return mapProduct(data as ProductRow);
}

export async function updateProductRecord(id: string, patch: Partial<Omit<Product, "id">>) {
  if (!usingSupabase()) {
    return;
  }

  const { error } = await requireSupabase()
    .from("products")
    .update({
      ...patch,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo guardar el producto: ${error.message}`);
  }
}

export async function deleteProductRecord(id: string) {
  if (!usingSupabase()) {
    return;
  }

  const { error } = await requireSupabase().from("products").delete().eq("id", id);

  if (error) {
    throw new Error(`No se pudo eliminar el producto: ${error.message}`);
  }
}

export async function listUsers(options: { activeOnly?: boolean } = {}) {
  if (!usingSupabase()) {
    return options.activeOnly ? mockUsers.filter((user) => user.active) : mockUsers;
  }

  let query = requireSupabase().from("profiles").select("id,name,email,role,shift,active").order("name");

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
  if (!usingSupabase()) {
    return mockUsers.find((user) => user.id === id) ?? mockUsers[0];
  }

  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id,name,email,role,shift,active")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`No se pudo cargar el usuario: ${error.message}`);
  }

  return mapProfile(data as ProfileRow);
}

export async function createUser(input: Omit<AppUser, "id">) {
  if (!usingSupabase()) {
    return { ...input, id: `usr-${Date.now()}` };
  }

  const { data, error } = await requireSupabase()
    .from("profiles")
    .insert({
      name: input.name,
      email: input.email,
      role: input.role,
      shift: input.shift ?? "",
      active: input.active
    })
    .select("id,name,email,role,shift,active")
    .single();

  if (error) {
    throw new Error(`No se pudo crear el usuario: ${error.message}`);
  }

  return mapProfile(data as ProfileRow);
}

export async function updateUserRecord(id: string, patch: Partial<Omit<AppUser, "id">>) {
  if (!usingSupabase()) {
    return;
  }

  const { error } = await requireSupabase()
    .from("profiles")
    .update({
      ...patch,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    throw new Error(`No se pudo guardar el usuario: ${error.message}`);
  }
}

export async function deleteUserRecord(id: string) {
  if (!usingSupabase()) {
    return;
  }

  const { error } = await requireSupabase().from("profiles").delete().eq("id", id);

  if (error) {
    throw new Error(`No se pudo eliminar el usuario: ${error.message}`);
  }
}

export async function loadCurrentUser() {
  const fallback = mockUsers[0];

  if (typeof window === "undefined") {
    return fallback;
  }

  const storedUserId = window.localStorage.getItem("inventario-cafe-user-id");

  if (!storedUserId) {
    const users = await listUsers({ activeOnly: true });
    return users[0] ?? fallback;
  }

  try {
    return await getProfileById(storedUserId);
  } catch {
    const users = await listUsers({ activeOnly: true });
    return users[0] ?? fallback;
  }
}

export async function listInventories() {
  if (!usingSupabase()) {
    return [...mockInventories].sort((a, b) => {
      const aDate = a.submittedAt ?? a.createdAt;
      const bDate = b.submittedAt ?? b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  const { data, error } = await requireSupabase()
    .from("inventory_sessions")
    .select(
      "id,status,user_id,user_name,user_email,shift,created_at,submitted_at,profiles(name,email),inventory_items(id,inventory_session_id,product_id,product_name,category,unit,physical_stock,fudo_stock,difference,comment)"
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudo cargar el historial: ${error.message}`);
  }

  return (data as InventorySessionRow[]).map(mapInventory);
}

export async function getInventoryRecord(id: string) {
  if (!usingSupabase()) {
    return mockInventories.find((inventory) => inventory.id === id);
  }

  const { data, error } = await requireSupabase()
    .from("inventory_sessions")
    .select(
      "id,status,user_id,user_name,user_email,shift,created_at,submitted_at,profiles(name,email),inventory_items(id,inventory_session_id,product_id,product_name,category,unit,physical_stock,fudo_stock,difference,comment)"
    )
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`No se pudo cargar el detalle del inventario: ${error.message}`);
  }

  return mapInventory(data as InventorySessionRow);
}

export async function submitInventoryRecord(user: AppUser, items: InventoryItem[]) {
  if (!usingSupabase()) {
    return;
  }

  const client = requireSupabase();
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await client
    .from("inventory_sessions")
    .insert({
      status: "submitted",
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
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
    physical_stock: item.physicalStock,
    fudo_stock: item.fudoStock,
    comment: item.comment || null
  }));

  const { error: itemsError } = await client.from("inventory_items").insert(rows);

  if (itemsError) {
    throw new Error(`No se pudo guardar el detalle del inventario: ${itemsError.message}`);
  }
}
