import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const RUTAS_RESERVADAS = new Set([
  "admin",
  "app",
  "auth",
  "login",
  "registro",
  "viandera",
  "api",
  "explorar",
]);

export function normalizarSlug(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function esSlugReservado(slug: string): boolean {
  return RUTAS_RESERVADAS.has(slug);
}

export async function generarSlugDisponible(
  supabase: SupabaseClient<Database>,
  nombreODeseado: string,
  vianderaIdAExcluir?: string,
): Promise<string> {
  const base = normalizarSlug(nombreODeseado) || "cocina";
  let candidato = base;
  let sufijo = 2;

  while (true) {
    if (!esSlugReservado(candidato)) {
      let query = supabase.from("vianderas").select("id").eq("slug", candidato);
      if (vianderaIdAExcluir) {
        query = query.neq("id", vianderaIdAExcluir);
      }
      const { data } = await query.maybeSingle();
      if (!data) return candidato;
    }
    candidato = `${base}-${sufijo}`;
    sufijo += 1;
  }
}
