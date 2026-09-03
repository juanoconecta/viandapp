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

/**
 * Únicas seis claves de metadata permitidas. Cualquier clave fuera de este
 * mapa se descarta sin excepción — así se prohíben teléfono, dirección,
 * email, nombre, mensaje, identificadores de auth y cualquier equivalente,
 * sin necesidad de una lista negra.
 */
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
  con_plato: (v) => typeof v === "boolean",
};

export type EventoPublico = {
  nombre: NombreEventoAnalitica;
  vianderaId?: string;
  viandaId?: string;
  metadata?: Record<string, string | number | boolean>;
};

function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_REGEX.test(valor);
}

function sanitizarMetadata(
  metadata: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;

  const limpio: Record<string, string | number | boolean> = {};

  for (const [clave, validador] of Object.entries(VALIDADORES_METADATA)) {
    const valor = metadata[clave];
    if (valor !== undefined && validador(valor)) {
      limpio[clave] = valor;
    }
  }

  return Object.keys(limpio).length > 0 ? limpio : undefined;
}

/**
 * Contrato restringido de entrada/salida — deliberadamente separado de
 * `EventoAnalitica` (la fila de la tabla): acepta ids en camelCase sin
 * validar todavía, y devuelve solo lo que ya pasó la sanitización. Nunca se
 * usa esta forma amplia como si fuera la fila real de la base.
 */
export function sanitizarEvento(evento: EventoPublico): EventoPublico {
  if (!(NOMBRES_VALIDOS as readonly string[]).includes(evento?.nombre ?? "")) {
    throw new Error("Nombre de evento de analítica inválido.");
  }

  const sanitizado: EventoPublico = { nombre: evento.nombre };

  if (esUuid(evento.vianderaId)) {
    sanitizado.vianderaId = evento.vianderaId;
  }
  if (esUuid(evento.viandaId)) {
    sanitizado.viandaId = evento.viandaId;
  }

  const metadataLimpia = sanitizarMetadata(evento.metadata);
  if (metadataLimpia) {
    sanitizado.metadata = metadataLimpia;
  }

  return sanitizado;
}

export async function registrarEvento(evento: EventoPublico): Promise<void> {
  try {
    const seguro = sanitizarEvento(evento);
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
      console.error("[analitica] no se pudo registrar el evento", error);
    }
  } catch (error) {
    console.error("[analitica] evento descartado antes de escribir", error);
  }
}
