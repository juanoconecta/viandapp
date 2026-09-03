import "server-only";

import { createAdminClient } from "../supabase/admin";
import type { Database, NombreEventoAnalitica } from "../../types";

const NOMBRES_VALIDOS = [
  "explore_viewed",
  "search_submitted",
  "filter_applied",
  "profile_viewed",
  "dish_selected",
  "whatsapp_intent",
  "whatsapp_clicked",
] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ORIGENES_VALIDOS = ["explorar", "perfil"] as const;
const FILTROS_VALIDOS = ["tipo", "etiqueta", "modalidad"] as const;
const TIPOS_PLATO_VALIDOS = ["almuerzo", "cena", "ambos"] as const;
const MODALIDADES_VALIDAS = ["retiro", "envio"] as const;
const LARGO_MAXIMO_BUSQUEDA = 80;

type ReglaIds = "ninguno" | "solo-viandera" | "solo-vianda" | "vianda-o-viandera-sola";

type ReglaEvento = {
  ids: ReglaIds;
  metadataPermitida: readonly string[];
};

/**
 * Reglas por evento, no una lista global: cada nombre define qué IDs y qué
 * claves de metadata tienen sentido para él. "con_plato" no aparece acá
 * porque nunca se acepta del cliente — se deriva server-side en
 * `resolverIds` para los eventos de WhatsApp.
 */
const REGLAS_POR_EVENTO: Record<NombreEventoAnalitica, ReglaEvento> = {
  explore_viewed: { ids: "ninguno", metadataPermitida: ["origen"] },
  search_submitted: {
    ids: "ninguno",
    metadataPermitida: ["origen", "busqueda_longitud"],
  },
  filter_applied: {
    ids: "ninguno",
    metadataPermitida: ["origen", "filtro", "tipo_plato", "modalidad"],
  },
  profile_viewed: { ids: "solo-viandera", metadataPermitida: ["origen"] },
  dish_selected: {
    ids: "solo-vianda",
    metadataPermitida: ["origen", "tipo_plato"],
  },
  whatsapp_intent: {
    ids: "vianda-o-viandera-sola",
    metadataPermitida: ["origen"],
  },
  whatsapp_clicked: {
    ids: "vianda-o-viandera-sola",
    metadataPermitida: ["origen"],
  },
};

const VALIDADORES_METADATA: Record<string, (valor: unknown) => boolean> = {
  origen: (v) =>
    typeof v === "string" && (ORIGENES_VALIDOS as readonly string[]).includes(v),
  busqueda_longitud: (v) =>
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= 0 &&
    v <= LARGO_MAXIMO_BUSQUEDA,
  filtro: (v) =>
    typeof v === "string" && (FILTROS_VALIDOS as readonly string[]).includes(v),
  tipo_plato: (v) =>
    typeof v === "string" &&
    (TIPOS_PLATO_VALIDOS as readonly string[]).includes(v),
  modalidad: (v) =>
    typeof v === "string" &&
    (MODALIDADES_VALIDAS as readonly string[]).includes(v),
};

const EVENTOS_WHATSAPP = new Set<NombreEventoAnalitica>([
  "whatsapp_intent",
  "whatsapp_clicked",
]);

export type EventoPublico = {
  nombre: NombreEventoAnalitica;
  vianderaId?: string;
  viandaId?: string;
  metadata?: Record<string, string | number | boolean>;
};

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_REGEX.test(valor);
}

function resolverIds(
  regla: ReglaIds,
  entrada: Record<string, unknown>,
): { vianderaId?: string; viandaId?: string } {
  switch (regla) {
    case "ninguno":
      return {};
    case "solo-viandera":
      return esUuid(entrada.vianderaId)
        ? { vianderaId: entrada.vianderaId }
        : {};
    case "solo-vianda":
      return esUuid(entrada.viandaId) ? { viandaId: entrada.viandaId } : {};
    case "vianda-o-viandera-sola":
      // Nunca se confía en una pareja (vianderaId, viandaId) enviada junta:
      // si hay un viandaId válido, se guarda solo ese — nunca el vianderaId
      // que lo acompañe, porque podría pertenecer a otra viandera. Un
      // vianderaId sin viandaId no tiene con qué desparejarse, así que ese
      // caso sí se acepta solo.
      if (esUuid(entrada.viandaId)) return { viandaId: entrada.viandaId };
      if (esUuid(entrada.vianderaId))
        return { vianderaId: entrada.vianderaId };
      return {};
  }
}

function sanitizarMetadata(
  metadata: unknown,
  clavesPermitidas: readonly string[],
): Record<string, string | number | boolean> | undefined {
  if (!esObjetoPlano(metadata)) return undefined;

  const limpio: Record<string, string | number | boolean> = {};

  for (const clave of clavesPermitidas) {
    const validador = VALIDADORES_METADATA[clave];
    const valor = metadata[clave];
    if (validador && valor !== undefined && validador(valor)) {
      limpio[clave] = valor as string | number | boolean;
    }
  }

  return Object.keys(limpio).length > 0 ? limpio : undefined;
}

/**
 * Contrato restringido de entrada/salida — deliberadamente separado de
 * `EventoAnalitica` (la fila de la tabla): acepta cualquier valor `unknown`
 * en el límite público y solo devuelve una forma seria (`EventoPublico`) o
 * `null` cuando el payload no es válido. Nunca lanza para un rechazo
 * esperable — un evento mal formado es una entrada inválida común, no una
 * excepción.
 */
export function sanitizarEvento(entrada: unknown): EventoPublico | null {
  if (!esObjetoPlano(entrada)) return null;

  const nombre = entrada.nombre;
  if (!(NOMBRES_VALIDOS as readonly string[]).includes(nombre as string)) {
    return null;
  }
  const nombreValido = nombre as NombreEventoAnalitica;

  const regla = REGLAS_POR_EVENTO[nombreValido];
  const ids = resolverIds(regla.ids, entrada);

  const metadataLimpia = sanitizarMetadata(
    entrada.metadata,
    regla.metadataPermitida,
  );

  const sanitizado: EventoPublico = { nombre: nombreValido, ...ids };

  if (EVENTOS_WHATSAPP.has(nombreValido)) {
    // con_plato nunca se toma del cliente: se deriva de si terminó
    // quedando un viandaId válido después de resolver la regla de IDs.
    sanitizado.metadata = {
      ...(metadataLimpia ?? {}),
      con_plato: Boolean(ids.viandaId),
    };
  } else if (metadataLimpia) {
    sanitizado.metadata = metadataLimpia;
  }

  return sanitizado;
}

export async function registrarEvento(evento: EventoPublico): Promise<void> {
  const seguro = sanitizarEvento(evento);
  if (!seguro) {
    // Un payload rechazado es una entrada inválida esperable, no una falla
    // del servidor: se descarta en silencio, sin loguear (y nunca se loguea
    // el payload recibido).
    return;
  }

  try {
    const admin = createAdminClient();

    const payload: Database["public"]["Tables"]["eventos_analitica"]["Insert"] =
      {
        nombre: seguro.nombre,
        ...(seguro.vianderaId ? { viandera_id: seguro.vianderaId } : {}),
        ...(seguro.viandaId ? { vianda_id: seguro.viandaId } : {}),
        ...(seguro.metadata ? { metadata: seguro.metadata } : {}),
      };

    const { error } = await admin.from("eventos_analitica").insert(payload);

    if (error) {
      console.error("[analitica] fallo al insertar evento", error);
    }
  } catch (error) {
    console.error("[analitica] fallo inesperado al registrar evento", error);
  }
}
