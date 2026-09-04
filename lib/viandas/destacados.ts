import type { ResultadoPlato } from "./consultas";

export type ResultadoDestacados =
  | { estado: "resultado"; platos: ResultadoPlato[] }
  | { estado: "vacio" }
  | { estado: "error" };

/**
 * Clasifica el resultado de una búsqueda de platos destacados en uno
 * de tres estados honestos — nunca confunde "sin platos cargados" con
 * "la consulta falló". `buscar` es inyectable a propósito: en
 * producción es `() => buscarPlatos(FILTROS_SIN_RESTRICCIONES)`, en
 * tests es un stub que no toca Supabase.
 */
export async function clasificarDestacados(
  buscar: () => Promise<ResultadoPlato[]>,
  limite: number,
): Promise<ResultadoDestacados> {
  let platos: ResultadoPlato[];
  try {
    platos = await buscar();
  } catch {
    return { estado: "error" };
  }
  const recortados = platos.slice(0, limite);
  if (recortados.length === 0) return { estado: "vacio" };
  return { estado: "resultado", platos: recortados };
}
