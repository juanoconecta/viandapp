import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResultadoPurgado =
  | { ok: true; pedidosPurgados: number; contadoresLimpiados: number }
  | { ok: false; error: string };

const RETENCION_LIMITADOR_DIAS = 7;

export async function ejecutarPurgado(): Promise<ResultadoPurgado> {
  const admin = createAdminClient();
  const ahora = new Date();

  const { data: candidatos, error: errorSelect } = await admin
    .from("pedidos")
    .select("id")
    .eq("datos_purgados", false)
    .lte("purgar_datos_en", ahora.toISOString());

  if (errorSelect) {
    return { ok: false, error: "No pudimos consultar pedidos vencidos." };
  }

  const ids = (candidatos ?? []).map((p) => p.id);
  let pedidosPurgados = 0;

  if (ids.length > 0) {
    const { error: errorUpdate, count } = await admin
      .from("pedidos")
      .update(
        {
          nombre_comprador: null,
          telefono_comprador: null,
          direccion_envio: null,
          datos_purgados: true,
        },
        { count: "exact" },
      )
      .in("id", ids)
      .select("id");

    // Corregido en esta revision: si la escritura falla, se devuelve
    // error explicito -- nunca se reporta "purgados: N" sin haber
    // confirmado que el update efectivamente se aplico.
    if (errorUpdate) {
      return { ok: false, error: "No pudimos purgar los pedidos vencidos." };
    }
    pedidosPurgados = count ?? ids.length;
  }

  const limiteRetencion = new Date(ahora.getTime() - RETENCION_LIMITADOR_DIAS * 24 * 60 * 60 * 1000);
  const { error: errorLimite, count: contadoresLimpiados } = await admin
    .from("limite_solicitudes")
    .delete({ count: "exact" })
    .lt("ventana_inicio", limiteRetencion.toISOString())
    .select("clave");

  if (errorLimite) {
    // El purgado de pedidos ya se aplico -- no se revierte, pero se
    // reporta el fallo parcial en vez de un exito completo falso.
    return { ok: false, error: "Pedidos purgados, pero falló la limpieza del limitador." };
  }

  return { ok: true, pedidosPurgados, contadoresLimpiados: contadoresLimpiados ?? 0 };
}
