import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export class AuthRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
  }
}

export async function requireAuthenticatedRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (!token) {
    console.warn("[auth] token ausente en solicitud protegida");
    throw new AuthRequestError("Debes iniciar sesion nuevamente.", 401);
  }

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);

  if (authError) {
    console.warn("[auth] token invalido o expirado", { reason: authError.message });
    throw new AuthRequestError("Sesion invalida o expirada. Debes iniciar sesion nuevamente.", 401);
  }

  if (!authData.user) {
    console.warn("[auth] usuario Auth no encontrado para token validado");
    throw new AuthRequestError("Debes iniciar sesion nuevamente.", 401);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,name,email,role,area_id,active")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    console.warn("[auth] perfil no encontrado para usuario Auth", { userId: authData.user.id, reason: profileError?.message });
    throw new AuthRequestError("No se encontro el perfil del usuario.", 403);
  }

  if (!profile.active) {
    console.warn("[auth] usuario inactivo", { userId: authData.user.id });
    throw new AuthRequestError("Tu usuario esta inactivo.", 403);
  }

  return { admin, authUser: authData.user, profile };
}

export async function requireAdminRequest(request: NextRequest) {
  const { admin, authUser, profile } = await requireAuthenticatedRequest(request);

  if (profile.role !== "admin") {
    console.warn("[auth] rol no admin en accion administrativa", { userId: authUser.id, role: profile.role });
    throw new AuthRequestError("No tienes permisos de administrador.", 403);
  }

  return { admin, authUser, profile };
}
