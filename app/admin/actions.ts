"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAdmin } from "@/lib/auth/admin";
import { generarSlugDisponible } from "@/lib/viandera/slug";

export type EstadoInvitacion =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function invitarViandera(
  _prevState: EstadoInvitacion,
  formData: FormData,
): Promise<EstadoInvitacion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esAdmin(user?.email)) {
    return { status: "error", mensaje: "No autorizado." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!nombre || !email) {
    return { status: "error", mensaje: "Completá el nombre y el email." };
  }

  const admin = createAdminClient();
  const slug = await generarSlugDisponible(admin, nombre);

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
      slug,
    })
    .select("id")
    .single();

  if (errorInsert || !viandera) {
    return {
      status: "error",
      mensaje: "No pudimos crear la viandera. Probá de nuevo.",
    };
  }

  const { data: invitado, error: errorInvite } =
    await admin.auth.admin.inviteUserByEmail(email);

  if (errorInvite || !invitado?.user) {
    await admin.from("vianderas").delete().eq("id", viandera.id);
    return {
      status: "error",
      mensaje:
        "No pudimos enviar la invitación (¿el email ya tiene una cuenta?).",
    };
  }

  const { error: errorLink } = await admin
    .from("vianderas")
    .update({ user_id: invitado.user.id })
    .eq("id", viandera.id);

  if (errorLink) {
    return {
      status: "error",
      mensaje:
        "La invitación se envió, pero no pudimos vincular la cuenta. Revisalo manualmente en Supabase.",
    };
  }

  revalidatePath("/admin");
  return { status: "ok" };
}
