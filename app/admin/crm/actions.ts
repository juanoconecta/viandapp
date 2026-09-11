"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAdmin } from "@/lib/auth/admin";
import type { EstadoCrmContacto, TipoCrmInteraccion } from "@/types";

export type ResultadoAccion =
  | { status: "idle" }
  | { status: "ok"; mensaje?: string }
  | { status: "error"; mensaje: string };

const TIPOS_CONTACTO_LIBRE = ["aliado_estrategico", "otro"] as const;

const ESTADOS_CONTACTO: EstadoCrmContacto[] = [
  "nuevo",
  "en_conversacion",
  "calificado",
  "activo",
  "inactivo",
  "descartado",
];

const TIPOS_INTERACCION: TipoCrmInteraccion[] = [
  "llamada",
  "whatsapp",
  "email",
  "reunion",
  "cambio_estado",
  "otro",
];

export async function crearContactoLibre(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const tipo = String(formData.get("tipo") ?? "");
  if (!TIPOS_CONTACTO_LIBRE.includes(tipo as (typeof TIPOS_CONTACTO_LIBRE)[number])) {
    return { status: "error", mensaje: "Ese tipo de contacto no es válido acá." };
  }

  const nombreLibre = String(formData.get("nombreLibre") ?? "").trim().slice(0, 200);
  if (!nombreLibre) {
    return { status: "error", mensaje: "El nombre no puede estar vacío." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("crm_contactos").insert({
    tipo: tipo as "aliado_estrategico" | "otro",
    nombre_libre: nombreLibre,
    fuente: "contacto_directo",
    estado: "nuevo",
  });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos crear el contacto. Probá de nuevo.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  return { status: "ok" };
}

export async function actualizarEstadoContacto(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const contactoId = String(formData.get("contactoId") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!contactoId || !ESTADOS_CONTACTO.includes(estado as EstadoCrmContacto)) {
    return { status: "error", mensaje: "Ese estado no es válido." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_contactos")
    .update({ estado: estado as EstadoCrmContacto })
    .eq("id", contactoId);

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos actualizar el estado. Probá de nuevo.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}

export async function vincularPedidoManualmente(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const contactoId = String(formData.get("contactoId") ?? "");
  const pedidoId = String(formData.get("pedidoId") ?? "");
  if (!contactoId || !pedidoId) {
    return { status: "error", mensaje: "Faltan datos." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_contacto_pedidos")
    .insert({ contacto_id: contactoId, pedido_id: pedidoId });

  if (error) {
    if (error.code === "23503") {
      return {
        status: "error",
        mensaje: "No encontramos ese contacto o ese pedido.",
      };
    }
    return {
      status: "error",
      mensaje: "No pudimos vincular el pedido. Probá de nuevo.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}

export async function retirarConsentimiento(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const contactoId = String(formData.get("contactoId") ?? "");
  if (!contactoId) return { status: "error", mensaje: "Faltan datos." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crm_contactos")
    .update({ consentimiento_retirado_en: new Date().toISOString() })
    .eq("id", contactoId)
    .eq("tipo", "consumidor")
    .select("id");

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos retirar el consentimiento. Probá de nuevo.",
    };
  }
  if (!data || data.length === 0) {
    return {
      status: "error",
      mensaje: "No encontramos un contacto consumidor con ese ID.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}

export async function anonimizarContacto(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const contactoId = String(formData.get("contactoId") ?? "");
  if (!contactoId) return { status: "error", mensaje: "Faltan datos." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crm_contactos")
    .update({
      nombre_libre: null,
      contacto_libre: null,
      pii_eliminada: true,
      consentimiento_retirado_en: new Date().toISOString(),
    })
    .eq("id", contactoId)
    .eq("tipo", "consumidor")
    .select("id");

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos anonimizar el contacto. Probá de nuevo.",
    };
  }
  if (!data || data.length === 0) {
    return {
      status: "error",
      mensaje: "No encontramos un contacto consumidor con ese ID.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}

export async function agregarNota(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const contactoId = String(formData.get("contactoId") ?? "");
  const texto = String(formData.get("texto") ?? "").trim().slice(0, 2000);
  if (!contactoId || !texto) {
    return { status: "error", mensaje: "La nota no puede estar vacía." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("crm_notas")
    .insert({ contacto_id: contactoId, texto });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar la nota. Probá de nuevo.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}

export async function crearTarea(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const contactoId = String(formData.get("contactoId") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim().slice(0, 200);
  const venceEnRaw = String(formData.get("venceEn") ?? "").trim();
  if (!contactoId || !titulo) {
    return { status: "error", mensaje: "El título no puede estar vacío." };
  }

  let venceEn: string | null = null;
  if (venceEnRaw) {
    const fecha = new Date(venceEnRaw);
    if (Number.isNaN(fecha.getTime())) {
      return { status: "error", mensaje: "La fecha no es válida." };
    }
    venceEn = fecha.toISOString();
  }

  const admin = createAdminClient();
  const { error } = await admin.from("crm_tareas").insert({
    contacto_id: contactoId,
    titulo,
    vence_en: venceEn,
  });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos crear la tarea. Probá de nuevo.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}

export async function completarTarea(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const tareaId = String(formData.get("tareaId") ?? "");
  if (!tareaId) return { status: "error", mensaje: "Faltan datos." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crm_tareas")
    .update({ completada: true, completada_en: new Date().toISOString() })
    .eq("id", tareaId)
    .select("contacto_id");

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos completar la tarea. Probá de nuevo.",
    };
  }
  if (!data || data.length === 0) {
    return {
      status: "error",
      mensaje: "No encontramos esa tarea.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${data[0].contacto_id}`);
  return { status: "ok" };
}

export async function registrarInteraccion(
  _prevState: ResultadoAccion,
  formData: FormData,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!esAdmin(user?.email)) return { status: "error", mensaje: "No autorizado." };

  const contactoId = String(formData.get("contactoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const resumen = String(formData.get("resumen") ?? "").trim().slice(0, 1000);
  if (
    !contactoId ||
    !TIPOS_INTERACCION.includes(tipo as TipoCrmInteraccion) ||
    !resumen
  ) {
    return {
      status: "error",
      mensaje: "Completá el tipo y el resumen de la interacción.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("crm_interacciones").insert({
    contacto_id: contactoId,
    tipo: tipo as TipoCrmInteraccion,
    resumen,
  });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos registrar la interacción. Probá de nuevo.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${contactoId}`);
  return { status: "ok" };
}
