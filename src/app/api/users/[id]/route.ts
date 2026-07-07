import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/server-auth";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { admin } = await requireAdminRequest(request);
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = body.role === "admin" ? "admin" : "trabajador";
    const areaId = typeof body.areaId === "string" ? body.areaId : "";
    const active = Boolean(body.active);

    if (!name || !email || !areaId) {
      return NextResponse.json({ error: "Nombre, email y area son obligatorios." }, { status: 400 });
    }

    const { data: area, error: areaError } = await admin
      .from("areas")
      .select("id")
      .eq("id", areaId)
      .eq("active", true)
      .single();

    if (areaError || !area) {
      return NextResponse.json({ error: "Selecciona un area valida." }, { status: 400 });
    }

    const authPatch: { email: string; password?: string; user_metadata: { name: string } } = {
      email,
      user_metadata: { name }
    };

    if (password) {
      authPatch.password = password;
    }

    const { error: authError } = await admin.auth.admin.updateUserById(params.id, authPatch);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update({
        name,
        email,
        role,
        area_id: areaId,
        active,
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .select("id,name,email,role,area_id,active,areas(id,name,active)")
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ user: profile });
  } catch (error) {
    console.error("Error actualizando usuario", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el usuario." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { admin, authUser } = await requireAdminRequest(request);

    if (authUser.id === params.id) {
      return NextResponse.json({ error: "No puedes eliminar tu propio usuario mientras estas conectado." }, { status: 400 });
    }

    const { count, error: countError } = await admin
      .from("inventory_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Este usuario tiene inventarios asociados. Desactivalo para mantener la trazabilidad." },
        { status: 400 }
      );
    }

    const { error: profileError } = await admin.from("profiles").delete().eq("id", params.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { error: authError } = await admin.auth.admin.deleteUser(params.id);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error eliminando usuario", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el usuario." },
      { status: 500 }
    );
  }
}
