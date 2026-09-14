import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CrmContactoResumen,
  CrmInteraccion,
  CrmNota,
  CrmTarea,
  EstadoCrmContacto,
  Pedido,
  TipoCrmContacto,
} from "@/types";

export type ResumenAdmin = {
  contactosNuevos: number;
  tareasVencidas: number;
};

export type FiltrosCrm = {
  busqueda?: string;
  tipo?: TipoCrmContacto;
  estado?: EstadoCrmContacto;
  consentimiento?: "vigente" | "retirado" | "anonimizado";
};

export type DetalleContacto = {
  contacto: CrmContactoResumen;
  notas: CrmNota[];
  tareas: CrmTarea[];
  interacciones: CrmInteraccion[];
  pedidos: Pick<Pedido, "id" | "total" | "modalidad" | "estado" | "created_at">[];
};

const MENSAJE_ERROR_CONTACTOS = "No pudimos obtener los contactos.";

/**
 * Vive en lib/crm, así que solo devuelve conteos propios del CRM — no
 * pedidos/Puni, que pertenecen a sus propios módulos de consulta y se
 * combinan en el dashboard de /admin (Task 5, no esta tarea).
 */
export async function obtenerResumenAdmin(): Promise<ResumenAdmin> {
  const admin = createAdminClient();
  const ahora = new Date().toISOString();

  const [{ count: contactosNuevos }, { count: tareasVencidas }] = await Promise.all([
    admin.from("crm_contactos").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
    admin
      .from("crm_tareas")
      .select("id", { count: "exact", head: true })
      .eq("completada", false)
      .lt("vence_en", ahora)
      .not("vence_en", "is", null),
  ]);

  return { contactosNuevos: contactosNuevos ?? 0, tareasVencidas: tareasVencidas ?? 0 };
}

/**
 * Consulta la vista crm_contactos_resumen — no crm_contactos crudo — porque
 * ahí es donde el PII ya está resuelto/nuleado correctamente, y es
 * exactamente lo que la UI de listado (Task 6) va a renderizar.
 */
export async function listarContactos(
  filtros: FiltrosCrm = {},
): Promise<CrmContactoResumen[]> {
  const admin = createAdminClient();
  let consulta = admin.from("crm_contactos_resumen").select("*");

  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo);
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
  if (filtros.busqueda) {
    const termino = `%${filtros.busqueda}%`;
    consulta = consulta.or(`nombre.ilike.${termino},contacto.ilike.${termino}`);
  }
  if (filtros.consentimiento === "anonimizado") {
    consulta = consulta.eq("pii_eliminada", true);
  } else if (filtros.consentimiento === "retirado") {
    consulta = consulta.eq("pii_eliminada", false).not("consentimiento_retirado_en", "is", null);
  } else if (filtros.consentimiento === "vigente") {
    consulta = consulta.eq("pii_eliminada", false).is("consentimiento_retirado_en", null);
  }

  const { data, error } = await consulta.order("updated_at", { ascending: false });
  if (error) throw new Error(MENSAJE_ERROR_CONTACTOS);
  return data ?? [];
}

/**
 * "Nunca reconstruye PII desde un pedido": la consulta de pedidos puente
 * selecciona únicamente columnas operativas (id, total, modalidad, estado,
 * created_at) — nunca nombre_comprador/telefono_comprador/direccion_envio.
 * Los pedidos vinculados sí se muestran (son datos operativos útiles para
 * el detalle), solo su identidad de comprador no se usa para nada acá.
 */
export async function obtenerDetalleContacto(id: string): Promise<DetalleContacto | null> {
  const admin = createAdminClient();

  const { data: contacto } = await admin
    .from("crm_contactos_resumen")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!contacto) return null;

  const [{ data: notas }, { data: tareas }, { data: interacciones }, { data: puentes }] =
    await Promise.all([
      admin.from("crm_notas").select("*").eq("contacto_id", id).order("created_at", { ascending: false }),
      admin.from("crm_tareas").select("*").eq("contacto_id", id).order("created_at", { ascending: false }),
      admin
        .from("crm_interacciones")
        .select("*")
        .eq("contacto_id", id)
        .order("created_at", { ascending: false }),
      admin.from("crm_contacto_pedidos").select("pedido_id").eq("contacto_id", id),
    ]);

  const pedidoIds = (puentes ?? []).map((p) => p.pedido_id);
  const { data: pedidos } = pedidoIds.length > 0
    ? await admin
        .from("pedidos")
        .select("id, total, modalidad, estado, created_at")
        .in("id", pedidoIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return {
    contacto,
    notas: notas ?? [],
    tareas: tareas ?? [],
    interacciones: interacciones ?? [],
    pedidos: pedidos ?? [],
  };
}
