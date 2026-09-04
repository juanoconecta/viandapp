import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { EstadoAdhesionPuni } from "./transiciones";

export type EstadoAdhesionVendedora = {
  estado: EstadoAdhesionPuni;
  costoEnvioPuni: number | null;
  notaAdmin: string | null;
};

export async function obtenerAdhesionPropia(
  vianderaId: string,
): Promise<EstadoAdhesionVendedora | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("puni_adhesiones")
    .select("estado, costo_envio_puni, nota_admin")
    .eq("viandera_id", vianderaId)
    .maybeSingle();

  if (!data) return null;

  return {
    estado: data.estado,
    costoEnvioPuni: data.costo_envio_puni,
    notaAdmin: data.nota_admin,
  };
}
