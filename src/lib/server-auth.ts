import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function requireAdminRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (!token) {
    throw new Error("No hay sesion activa.");
  }

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);

  if (authError || !authData.user) {
    throw new Error("Sesion invalida.");
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,role,active")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("No se encontro el perfil del usuario.");
  }

  if (!profile.active) {
    throw new Error("Tu usuario esta inactivo.");
  }

  if (profile.role !== "admin") {
    throw new Error("No tienes permisos de administrador.");
  }

  return { admin, authUser: authData.user, profile };
}
