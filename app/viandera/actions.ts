"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { pathDesdeFotoUrl } from "@/lib/viandera/storage";
import type { Database } from "@/types";

async function obtenerVianderaId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("vianderas")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
}

export async function alternarDisponibilidad(formData: FormData): Promise<void> {
  const viandaId = String(formData.get("viandaId") ?? "");
  const disponibleActual = formData.get("disponible") === "true";

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) redirect("/app");

  await supabase
    .from("viandas")
    .update({ disponible: !disponibleActual })
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId);

  revalidatePath("/viandera");
}

export async function borrarPlato(formData: FormData): Promise<void> {
  const viandaId = String(formData.get("viandaId") ?? "");

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) redirect("/app");

  const { data: plato } = await supabase
    .from("viandas")
    .select("foto_url")
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId)
    .maybeSingle();

  await supabase
    .from("viandas")
    .delete()
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId);

  if (plato?.foto_url) {
    const path = pathDesdeFotoUrl(plato.foto_url);
    if (path) await supabase.storage.from("platos").remove([path]);
  }

  revalidatePath("/viandera");
}
