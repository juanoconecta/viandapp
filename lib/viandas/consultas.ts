import { createClient } from "../supabase/server";
import type { TipoVianda } from "../../types";
import type { FiltrosExplorador } from "./filtros";
import { adhesionesAprobadas } from "../envios/adhesionPublica";

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
    adheridaAPuni: boolean;
    costoEnvioPuni: number | null;
  };
};

const LIMITE_RESULTADOS = 48;

const MENSAJE_ERROR_PUBLICO = "No pudimos cargar las viandas disponibles.";

/**
 * Un plato "ambos" sirve tanto para almuerzo como para cena — filtrar por
 * "almuerzo" no debe esconder los platos que también aplican a esa franja.
 * `null` significa "sin filtro de tipo" (el valor "todos").
 */
export function tiposParaFiltro(
  tipo: FiltrosExplorador["tipo"],
): TipoVianda[] | null {
  if (tipo === "todos") return null;
  return [tipo, "ambos"];
}

/**
 * Escapa `\`, `%` y `_` antes de armar un patrón ILIKE — sin esto, un
 * usuario que busca literalmente "%" o "_" (o un patrón con esos
 * caracteres) termina haciendo un comodín que devuelve de todo. El orden
 * importa: `\` primero, para no escapar dos veces las barras que
 * introducen los otros dos reemplazos.
 */
export function escaparIlike(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Búsqueda ampliada (viandera, etiqueta, barrio) queda como mejora
 * posterior — hoy `buscarPlatos` solo hace ILIKE contra el nombre del
 * plato. `GlobalSearch` refleja esto en su copy ("Buscar por nombre del
 * plato"), no promete más de lo que esta función resuelve.
 *
 * Dos consultas separadas (vianderas, después viandas) en vez de un select
 * con embed — este `Database` está escrito a mano con `Relationships: []`
 * en cada tabla, así que un `vianderas!inner(...)` no tendría metadata de
 * relación para tipar bien el resultado. `app/[slug]/page.tsx` ya resuelve
 * el mismo problema con el mismo patrón de dos consultas.
 *
 * Un error real de Supabase se loguea completo solo en servidor y se
 * relanza sanitizado — nunca se traduce en un `[]`, porque eso lo
 * disfrazaría de "no hay resultados" en vez de "algo falló". `[]` solo se
 * devuelve cuando ambas consultas terminan bien y de verdad no hay platos
 * que coincidan.
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
    throw new Error(MENSAJE_ERROR_PUBLICO);
  }

  // Una viandera sin slug todavía no tiene página pública alcanzable — no
  // puede aparecer en resultados que enlazan a `/{slug}`. Esto es un
  // resultado legítimamente vacío, no un error.
  const vianderas = (vianderasCrudas ?? []).filter(
    (v): v is typeof v & { slug: string } => Boolean(v.slug),
  );

  if (vianderas.length === 0) {
    return [];
  }

  const vianderasPorId = new Map(vianderas.map((v) => [v.id, v]));
  const adhesiones = await adhesionesAprobadas(vianderas.map((v) => v.id));

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

  const tiposFiltro = tiposParaFiltro(filtros.tipo);
  if (tiposFiltro) {
    consultaViandas = consultaViandas.in("tipo", tiposFiltro);
  }

  if (filtros.etiqueta) {
    consultaViandas = consultaViandas.contains("etiquetas", [
      filtros.etiqueta,
    ]);
  }

  if (filtros.q) {
    consultaViandas = consultaViandas.ilike(
      "nombre",
      `%${escaparIlike(filtros.q)}%`,
    );
  }

  const { data: viandas, error: errorViandas } = await consultaViandas;

  if (errorViandas) {
    console.error("[explorar] fallo al consultar viandas", errorViandas);
    throw new Error(MENSAJE_ERROR_PUBLICO);
  }

  return (viandas ?? []).flatMap((plato) => {
    const viandera = vianderasPorId.get(plato.vianderas_id);
    if (!viandera) return [];
    const adhesion = adhesiones.get(plato.vianderas_id);

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
          adheridaAPuni: Boolean(adhesion),
          costoEnvioPuni: adhesion?.costo_envio_puni ?? null,
        },
      },
    ];
  });
}
