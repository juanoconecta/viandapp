"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoInvitacion =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function invitarViandera(
  _prevState: EstadoInvitacion,
  formData: FormData,
): Promise<EstadoInvitacion> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!nombre || !email) {
    return { status: "error", mensaje: "Completá el nombre y el email." };
  }

  const admin = createAdminClient();

  const { data: viandera, error: errorInsert } = await admin
    .from("vianderas")
    .insert({
      nombre,
      bio: null,
      lat: null,
      lng: null,
      telefono: null,
      activo: true,
      user_id: null,
    })
    .select("id")
    .single();

  if (errorInsert || !viandera) {
    return {
      status: "error",
      mensaje: "No pudimos crear la viandera. Probá de nuevo.",
    };
  }

  const { error: errorInvite } = await admin.auth.admin.inviteUserByEmail(
    email,
    { data: { vianderas_id: viandera.id } },
  );

  if (errorInvite) {
    await admin.from("vianderas").delete().eq("id", viandera.id);
    return {
      status: "error",
      mensaje:
        "No pudimos enviar la invitación (¿el email ya tiene una cuenta?).",
    };
  }

  revalidatePath("/admin");
  return { status: "ok" };
}
