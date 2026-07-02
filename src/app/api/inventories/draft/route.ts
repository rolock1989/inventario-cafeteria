import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-auth";

type DraftItemInput = {
  productId?: string;
  productName: string;
  category: string;
  unit: string;
  unitPriceAtTime: number;
  lossAmount: number;
  physicalStock: number;
  fudoStock: number;
  comment?: string;
};

function mapItemToRow(sessionId: string, item: DraftItemInput) {
  return {
    inventory_session_id: sessionId,
    product_id: item.productId || null,
    product_name: item.productName,
    category: item.category,
    unit: item.unit,
    unit_price_at_time: Number(item.unitPriceAtTime) || 0,
    loss_amount: Number(item.lossAmount) || 0,
    physical_stock: Number(item.physicalStock) || 0,
    fudo_stock: Number(item.fudoStock) || 0,
    comment: item.comment || null
  };
}

async function getOwnedDraft(admin: Awaited<ReturnType<typeof requireAuthenticatedRequest>>["admin"], userId: string, draftId?: string) {
  let query = admin
    .from("inventory_sessions")
    .select("id,user_id,status")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);

  if (draftId) {
    query = query.eq("id", draftId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string; user_id: string; status: "draft" } | null;
}

async function replaceDraftItems(
  admin: Awaited<ReturnType<typeof requireAuthenticatedRequest>>["admin"],
  sessionId: string,
  items: DraftItemInput[]
) {
  const { error: deleteError } = await admin.from("inventory_items").delete().eq("inventory_session_id", sessionId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (items.length === 0) {
    return;
  }

  const { error: insertError } = await admin.from("inventory_items").insert(items.map((item) => mapItemToRow(sessionId, item)));

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthenticatedRequest(request);
    const body = await request.json();
    const items = Array.isArray(body.items) ? (body.items as DraftItemInput[]) : [];
    const requestedDraftId = typeof body.draftId === "string" ? body.draftId : undefined;

    const existingDraft = await getOwnedDraft(admin, profile.id, requestedDraftId);
    let draftId = existingDraft?.id;

    if (draftId) {
      const { error: updateError } = await admin
        .from("inventory_sessions")
        .update({
          status: "draft",
          user_name: profile.name,
          user_email: profile.email,
          shift: body.shift || "Sin turno",
          submitted_at: null
        })
        .eq("id", draftId)
        .eq("user_id", profile.id)
        .eq("status", "draft");

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const { data: createdDraft, error: createError } = await admin
        .from("inventory_sessions")
        .insert({
          status: "draft",
          user_id: profile.id,
          user_name: profile.name,
          user_email: profile.email,
          shift: body.shift || "Sin turno",
          submitted_at: null
        })
        .select("id")
        .single();

      if (createError || !createdDraft) {
        throw new Error(createError?.message ?? "No se pudo crear el borrador.");
      }

      draftId = createdDraft.id;
    }

    if (!draftId) {
      throw new Error("No se pudo identificar el borrador.");
    }

    await replaceDraftItems(admin, draftId, items);

    return NextResponse.json({ draftId });
  } catch (error) {
    console.error("Error guardando borrador", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el borrador." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthenticatedRequest(request);
    const body = await request.json();
    const draftId = typeof body.draftId === "string" ? body.draftId : "";
    const items = Array.isArray(body.items) ? (body.items as DraftItemInput[]) : [];

    if (!draftId) {
      return NextResponse.json({ error: "No se encontro el borrador a enviar." }, { status: 400 });
    }

    const existingDraft = await getOwnedDraft(admin, profile.id, draftId);

    if (!existingDraft) {
      return NextResponse.json({ error: "No se encontro un borrador activo para este usuario." }, { status: 404 });
    }

    await replaceDraftItems(admin, draftId, items);

    const { error: submitError } = await admin
      .from("inventory_sessions")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        user_name: profile.name,
        user_email: profile.email,
        shift: body.shift || "Sin turno"
      })
      .eq("id", draftId)
      .eq("user_id", profile.id)
      .eq("status", "draft");

    if (submitError) {
      throw new Error(submitError.message);
    }

    return NextResponse.json({ inventoryId: draftId });
  } catch (error) {
    console.error("Error enviando borrador", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo enviar el borrador." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthenticatedRequest(request);
    const body = await request.json().catch(() => ({}));
    const draftId = typeof body.draftId === "string" ? body.draftId : "";

    if (!draftId) {
      return NextResponse.json({ error: "No se encontro el borrador a descartar." }, { status: 400 });
    }

    const { error } = await admin
      .from("inventory_sessions")
      .delete()
      .eq("id", draftId)
      .eq("user_id", profile.id)
      .eq("status", "draft");

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error descartando borrador", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo descartar el borrador." },
      { status: 500 }
    );
  }
}
