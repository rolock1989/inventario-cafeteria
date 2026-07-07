import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request);
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = body.role === "admin" ? "admin" : "trabajador";
    const areaId = typeof body.areaId === "string" ? body.areaId : "";
    const active = Boolean(body.active);

    if (!name || !email || !password || !areaId) {
      return NextResponse.json({ error: "Nombre, email, contrasena y area son obligatorios." }, { status: 400 });
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

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name
      }
    });

    if (authError || !created.user) {
      return NextResponse.json({ error: authError?.message ?? "No se pudo crear el usuario en Auth." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .insert({
        id: created.user.id,
        name,
        email,
        role,
        area_id: areaId,
        active
      })
      .select("id,name,email,role,area_id,active,areas(id,name,active)")
      .single();

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ user: profile });
  } catch (error) {
    console.error("Error creando usuario", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el usuario." },
      { status: 500 }
    );
  }
}
