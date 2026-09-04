import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AdhesionAprobada = {
  viandera_id: string;
  costo_envio_puni: number | null;
};

export async function adhesionesAprobadas(
  vianderaIds: string[],
): Promise<Map<string, AdhesionAprobada>> {
  if (vianderaIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("puni_adhesiones")
    .select("viandera_id, costo_envio_puni")
    .eq("estado", "aprobada")
    .in("viandera_id", vianderaIds);

  if (error) {
    console.error("[envios] fallo al consultar adhesiones aprobadas", error);
    return new Map();
  }

  return new Map((data ?? []).map((fila) => [fila.viandera_id, fila]));
}
