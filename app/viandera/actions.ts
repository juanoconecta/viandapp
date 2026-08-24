"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { pathDesdeFotoUrl } from "@/lib/viandera/storage";
import { generarSlugDisponible, normalizarSlug, esSlugReservado } from "@/lib/viandera/slug";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";
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

  const { error } = await supabase
    .from("viandas")
    .update({ disponible: !disponibleActual })
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId);

  if (error) {
    console.error("alternarDisponibilidad falló:", error.message);
  }

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
  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 100);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 500);
  const telefono = String(formData.get("telefono") ?? "").trim().slice(0, 30);
  const slugDeseado = String(formData.get("slug") ?? "").trim().slice(0, 60);
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

  let slug: string;
  if (slugDeseado) {
    const normalizado = normalizarSlug(slugDeseado);
    if (!normalizado || esSlugReservado(normalizado)) {
      return {
        status: "error",
        mensaje: "Esa dirección no está disponible. Probá con otra.",
      };
    }
    const { data: existente } = await supabase
      .from("vianderas")
      .select("id")
      .eq("slug", normalizado)
      .neq("id", vianderaId)
      .maybeSingle();
    if (existente) {
      return {
        status: "error",
        mensaje: "Esa dirección ya la está usando otra viandera.",
      };
    }
    slug = normalizado;
  } else {
    slug = await generarSlugDisponible(supabase, nombre, vianderaId);
  }

  const { error } = await supabase
    .from("vianderas")
    .update({
      nombre,
      bio: bio || null,
      telefono: telefono || null,
      slug,
      lat: latRaw ? Number(latRaw) : null,
      lng: lngRaw ? Number(lngRaw) : null,
    })
    .eq("id", vianderaId);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        mensaje: "Esa dirección ya la está usando otra viandera.",
      };
    }
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

  const { error } = await supabase
    .from("viandas")
    .delete()
    .eq("id", viandaId)
    .eq("vianderas_id", vianderaId);

  if (error) {
    console.error("borrarPlato falló:", error.message);
  }

  if (plato?.foto_url) {
    const path = pathDesdeFotoUrl(plato.foto_url);
    if (path) await supabase.storage.from("platos").remove([path]);
  }

  revalidatePath("/viandera");
}

export type EstadoPlato =
  | { status: "idle" }
  | { status: "error"; mensaje: string };

const TIPOS_FOTO_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024; // 5MB

function fotoValida(foto: File): boolean {
  return TIPOS_FOTO_PERMITIDOS.has(foto.type) && foto.size <= TAMANO_MAXIMO_FOTO;
}

async function subirFoto(
  supabase: SupabaseClient<Database>,
  vianderaId: string,
  foto: File,
): Promise<string | null> {
  const extension = EXTENSION_POR_TIPO[foto.type];
  const path = `${vianderaId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("platos")
    .upload(path, foto, { contentType: foto.type, upsert: false });

  if (error) return null;
  return supabase.storage.from("platos").getPublicUrl(path).data.publicUrl;
}

export async function crearPlato(
  _prevState: EstadoPlato,
  formData: FormData,
): Promise<EstadoPlato> {
  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 100);
  const descripcion = String(formData.get("descripcion") ?? "").trim().slice(0, 500);
  const precioRaw = String(formData.get("precio") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoVianda;
  const foto = formData.get("foto");
  const etiquetasEnviadas = formData.getAll("etiquetas").map(String);
  const etiquetas = etiquetasEnviadas.filter((valor) =>
    ETIQUETAS_DIETARIAS.some((et) => et.valor === valor),
  );

  if (!nombre || !tipo) {
    return { status: "error", mensaje: "Completá el nombre y el tipo." };
  }

  if (foto instanceof File && foto.size > 0 && !fotoValida(foto)) {
    return {
      status: "error",
      mensaje: "La foto debe ser una imagen (JPG, PNG, WEBP o GIF) de hasta 5MB.",
    };
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
    precio: precioRaw ? Math.min(999999, Math.max(0, Number(precioRaw))) : null,
    tipo,
    foto_url: fotoUrl,
    disponible: true,
    etiquetas,
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
  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 100);
  const descripcion = String(formData.get("descripcion") ?? "").trim().slice(0, 500);
  const precioRaw = String(formData.get("precio") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoVianda;
  const disponible = formData.get("disponible") === "on";
  const foto = formData.get("foto");
  const etiquetasEnviadas = formData.getAll("etiquetas").map(String);
  const etiquetas = etiquetasEnviadas.filter((valor) =>
    ETIQUETAS_DIETARIAS.some((et) => et.valor === valor),
  );

  if (!platoId || !nombre || !tipo) {
    return { status: "error", mensaje: "Completá el nombre y el tipo." };
  }

  if (foto instanceof File && foto.size > 0 && !fotoValida(foto)) {
    return {
      status: "error",
      mensaje: "La foto debe ser una imagen (JPG, PNG, WEBP o GIF) de hasta 5MB.",
    };
  }

  const supabase = await createClient();
  const vianderaId = await obtenerVianderaId(supabase);
  if (!vianderaId) {
    return { status: "error", mensaje: "No pudimos identificar tu perfil." };
  }

  const { data: platoActual } = await supabase
    .from("viandas")
    .select("foto_url")
    .eq("id", platoId)
    .eq("vianderas_id", vianderaId)
    .maybeSingle();

  if (!platoActual) {
    return { status: "error", mensaje: "No pudimos identificar el plato." };
  }

  let fotoUrl = platoActual.foto_url;
  if (foto instanceof File && foto.size > 0) {
    const nuevaUrl = await subirFoto(supabase, vianderaId, foto);
    if (nuevaUrl) {
      if (platoActual.foto_url) {
        const pathAnterior = pathDesdeFotoUrl(platoActual.foto_url);
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
      precio: precioRaw ? Math.min(999999, Math.max(0, Number(precioRaw))) : null,
      tipo,
      disponible,
      foto_url: fotoUrl,
      etiquetas,
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
