import { createClient } from "@/lib/supabase/server";
import type { TipoVianda } from "@/types";
import type { FiltrosExplorador } from "./filtros";

export type ResultadoPlato = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  tipo: TipoVianda;
  fotoUrl: string | null;
  etiquetas: string[];
  viandera: {
    nombre: string;
    slug: string;
    barrio: string | null;
    ofreceRetiro: boolean;
    ofreceEnvio: boolean;
  };
};

const LIMITE_RESULTADOS = 48;

/**
 * Dos consultas separadas (vianderas, después viandas) en vez de un select
 * con embed — este `Database` está escrito a mano con `Relationships: []`
 * en cada tabla, así que un `vianderas!inner(...)` no tendría metadata de
 * relación para tipar bien el resultado. `app/[slug]/page.tsx` ya resuelve
 * el mismo problema con el mismo patrón de dos consultas.
 */
export async function buscarPlatos(
  filtros: FiltrosExplorador,
): Promise<ResultadoPlato[]> {
  const supabase = await createClient();

  let consultaVianderas = supabase
    .from("vianderas")
    .select("id, nombre, slug, barrio, ofrece_retiro, ofrece_envio")
    .eq("activo", true);

  if (filtros.modalidad === "retiro") {
    consultaVianderas = consultaVianderas.eq("ofrece_retiro", true);
  } else if (filtros.modalidad === "envio") {
    consultaVianderas = consultaVianderas.eq("ofrece_envio", true);
  }

  const { data: vianderasCrudas, error: errorVianderas } =
    await consultaVianderas;

  if (errorVianderas) {
    console.error("[explorar] fallo al consultar vianderas", errorVianderas);
    return [];
  }

  // Una viandera sin slug todavía no tiene página pública alcanzable — no
  // puede aparecer en resultados que enlazan a `/{slug}`.
  const vianderas = (vianderasCrudas ?? []).filter(
    (v): v is typeof v & { slug: string } => Boolean(v.slug),
  );

  if (vianderas.length === 0) {
    return [];
  }

  const vianderasPorId = new Map(vianderas.map((v) => [v.id, v]));

  let consultaViandas = supabase
    .from("viandas")
    .select(
      "id, vianderas_id, nombre, descripcion, precio, tipo, foto_url, etiquetas",
    )
    .eq("disponible", true)
    .in(
      "vianderas_id",
      vianderas.map((v) => v.id),
    )
    .order("created_at", { ascending: false })
    .limit(LIMITE_RESULTADOS);

  if (filtros.tipo !== "todos") {
    consultaViandas = consultaViandas.eq("tipo", filtros.tipo);
  }

  if (filtros.etiqueta) {
    consultaViandas = consultaViandas.contains("etiquetas", [
      filtros.etiqueta,
    ]);
  }

  if (filtros.q) {
    consultaViandas = consultaViandas.ilike("nombre", `%${filtros.q}%`);
  }

  const { data: viandas, error: errorViandas } = await consultaViandas;

  if (errorViandas || !viandas) {
    if (errorViandas) {
      console.error("[explorar] fallo al consultar viandas", errorViandas);
    }
    return [];
  }

  return viandas.flatMap((plato) => {
    const viandera = vianderasPorId.get(plato.vianderas_id);
    if (!viandera) return [];

    return [
      {
        id: plato.id,
        nombre: plato.nombre,
        descripcion: plato.descripcion,
        precio: plato.precio,
        tipo: plato.tipo,
        fotoUrl: plato.foto_url,
        etiquetas: plato.etiquetas,
        viandera: {
          nombre: viandera.nombre,
          slug: viandera.slug,
          barrio: viandera.barrio,
          ofreceRetiro: viandera.ofrece_retiro,
          ofreceEnvio: viandera.ofrece_envio,
        },
      },
    ];
  });
}
