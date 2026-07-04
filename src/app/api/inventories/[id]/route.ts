import { NextRequest, NextResponse } from "next/server";
import { AuthRequestError, requireAdminRequest } from "@/lib/server-auth";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { admin } = await requireAdminRequest(request);

    const { data, error } = await admin
      .from("inventory_sessions")
      .delete()
      .eq("id", params.id)
      .eq("status", "submitted")
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "No se encontro el inventario." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Error eliminando inventario", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el inventario." },
      { status: 500 }
    );
  }
}
