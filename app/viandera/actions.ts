"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { pathDesdeFotoUrl, fotoUrlDesdePath } from "@/lib/viandera/storage";
import type { Database, TipoVianda } from "@/types";

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

export type EstadoPerfil =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "ok" };

export async function actualizarPerfil(
  _prevState: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const latRaw = String(formData.get("lat") ?? "");
  const lngRaw = String(formData.get("lng") ?? "");

  if (!nombre) {
    return { status: "error", mensaje: "El nombre no puede estar vacío." };
  }

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) {
    return { status: "error", mensaje: "No pudimos identificar tu perfil." };
  }

  const { error } = await supabase
    .from("vianderas")
    .update({
      nombre,
      bio: bio || null,
      telefono: telefono || null,
      lat: latRaw ? Number(latRaw) : null,
      lng: lngRaw ? Number(lngRaw) : null,
    })
    .eq("id", vianderaId);

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar los cambios. Probá de nuevo.",
    };
  }

  revalidatePath("/viandera/perfil");
  return { status: "ok" };
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

export type EstadoPlato =
  | { status: "idle" }
  | { status: "error"; mensaje: string };

async function subirFoto(
  supabase: SupabaseClient<Database>,
  vianderaId: string,
  foto: File,
): Promise<string | null> {
  const extension = foto.name.split(".").pop() || "jpg";
  const path = `${vianderaId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from("platos")
    .upload(path, foto, { contentType: foto.type, upsert: false });

  if (error) return null;
  return fotoUrlDesdePath(path);
}

export async function crearPlato(
  _prevState: EstadoPlato,
  formData: FormData,
): Promise<EstadoPlato> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const precioRaw = String(formData.get("precio") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoVianda;
  const foto = formData.get("foto");

  if (!nombre || !tipo) {
    return { status: "error", mensaje: "Completá el nombre y el tipo." };
  }

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) {
    return { status: "error", mensaje: "No pudimos identificar tu perfil." };
  }

  let fotoUrl: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    fotoUrl = await subirFoto(supabase, vianderaId, foto);
  }

  const { error } = await supabase.from("viandas").insert({
    vianderas_id: vianderaId,
    nombre,
    descripcion: descripcion || null,
    precio: precioRaw ? Number(precioRaw) : null,
    tipo,
    foto_url: fotoUrl,
    disponible: true,
  });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar el plato. Probá de nuevo.",
    };
  }

  revalidatePath("/viandera");
  redirect("/viandera");
}

export async function actualizarPlato(
  _prevState: EstadoPlato,
  formData: FormData,
): Promise<EstadoPlato> {
  const platoId = String(formData.get("platoId") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const precioRaw = String(formData.get("precio") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoVianda;
  const disponible = formData.get("disponible") === "on";
  const fotoUrlActual = String(formData.get("fotoUrlActual") ?? "") || null;
  const foto = formData.get("foto");

  if (!platoId || !nombre || !tipo) {
    return { status: "error", mensaje: "Completá el nombre y el tipo." };
  }

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) {
    return { status: "error", mensaje: "No pudimos identificar tu perfil." };
  }

  let fotoUrl = fotoUrlActual;
  if (foto instanceof File && foto.size > 0) {
    const nuevaUrl = await subirFoto(supabase, vianderaId, foto);
    if (nuevaUrl) {
      if (fotoUrlActual) {
        const pathAnterior = pathDesdeFotoUrl(fotoUrlActual);
        if (pathAnterior) {
          await supabase.storage.from("platos").remove([pathAnterior]);
        }
      }
      fotoUrl = nuevaUrl;
    }
  }

  const { error } = await supabase
    .from("viandas")
    .update({
      nombre,
      descripcion: descripcion || null,
      precio: precioRaw ? Number(precioRaw) : null,
      tipo,
      disponible,
      foto_url: fotoUrl,
    })
    .eq("id", platoId)
    .eq("vianderas_id", vianderaId);

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar los cambios. Probá de nuevo.",
    };
  }

  revalidatePath("/viandera");
  redirect("/viandera");
}
