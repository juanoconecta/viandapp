export const DURACION_ROTACION_MS = 6000;
export const DURACION_CROSSFADE_MS = 500;

export function siguienteIndice(indice: number, total: number): number {
  if (total <= 0) return 0;
  return (indice + 1) % total;
}

export function indiceAnterior(indice: number, total: number): number {
  if (total <= 0) return 0;
  return (indice - 1 + total) % total;
}

export type EstadoCarrusel = {
  indice: number;
  /** Estado explícito y persistente, controlado por el botón de
   * reproducción — la única fuente de verdad sobre si el carrusel
   * rota (spec, sección 5). */
  reproduciendo: boolean;
  /** Pausa transitoria por hover/foco — nunca modifica `reproduciendo`. */
  pausadoTemporalmente: boolean;
};

export type AccionCarrusel =
  | { tipo: "TICK" }
  | { tipo: "SIGUIENTE" }
  | { tipo: "ANTERIOR" }
  | { tipo: "IR_A"; indice: number }
  | { tipo: "ALTERNAR_REPRODUCCION" }
  | { tipo: "INTERACCION_INICIO" }
  | { tipo: "INTERACCION_FIN" };

export function estadoInicial(
  totalImagenes: number,
  autoplayInicial: boolean,
): EstadoCarrusel {
  return { indice: 0, reproduciendo: autoplayInicial, pausadoTemporalmente: false };
}

export function rotacionActiva(estado: EstadoCarrusel): boolean {
  return estado.reproduciendo && !estado.pausadoTemporalmente;
}

export function reducirCarrusel(
  estado: EstadoCarrusel,
  accion: AccionCarrusel,
  totalImagenes: number,
): EstadoCarrusel {
  switch (accion.tipo) {
    case "TICK": {
      if (!rotacionActiva(estado)) return estado;
      return { ...estado, indice: siguienteIndice(estado.indice, totalImagenes) };
    }
    case "SIGUIENTE":
      return { ...estado, indice: siguienteIndice(estado.indice, totalImagenes) };
    case "ANTERIOR":
      return { ...estado, indice: indiceAnterior(estado.indice, totalImagenes) };
    case "IR_A": {
      if (accion.indice < 0 || accion.indice >= totalImagenes) return estado;
      return { ...estado, indice: accion.indice };
    }
    case "ALTERNAR_REPRODUCCION":
      return { ...estado, reproduciendo: !estado.reproduciendo };
    case "INTERACCION_INICIO":
      return { ...estado, pausadoTemporalmente: true };
    case "INTERACCION_FIN":
      return { ...estado, pausadoTemporalmente: false };
    default:
      return estado;
  }
}
