export type DatosVinculo = {
  tipo: "cocina_potencial" | "cocina_activa" | "consumidor" |
    "aliado_estrategico" | "otro";
  vianderaId?: string | null;
  interesadoId?: string | null;
  nombreLibre?: string | null;
  contactoLibre?: string | null;
  consentimientoRetiradoEn?: string | null;
  piiEliminada?: boolean;
};

export type ResultadoValidacion =
  | { ok: true }
  | { ok: false; mensaje: string };

export function validarVinculo(datos: DatosVinculo): ResultadoValidacion {
  // Constraint 1: crm_contactos_libre_o_vinculado
  // Mirror SQL "IS NOT NULL" literalmente: una cadena vacía cuenta como
  // presente, igual que en Postgres. Nunca usar coerción truthy acá.
  const tieneVianderaId = datos.vianderaId != null;
  const tieneInteresadoId = datos.interesadoId != null;
  const tieneNombreLibre = datos.nombreLibre != null;
  const tieneContactoLibre = datos.contactoLibre != null;
  const piiEliminada = datos.piiEliminada === true;

  if (tieneVianderaId && tieneInteresadoId) {
    return {
      ok: false,
      mensaje: "Un contacto no puede estar vinculado a una viandera y a una interesada al mismo tiempo.",
    };
  }

  const tieneAlMenosUno = tieneVianderaId || tieneInteresadoId || tieneNombreLibre || piiEliminada;
  if (!tieneAlMenosUno) {
    return {
      ok: false,
      mensaje: "El contacto necesita un vínculo: una viandera, una interesada, un nombre libre, o estar anonimizado.",
    };
  }

  // Constraint 2: crm_contactos_anonimizacion_consistente
  // Si piiEliminada = true, todo lo demás abajo debe cumplirse en conjunto
  // (no es un "escape" alternativo): tipo consumidor, sin vínculos, sin
  // nombre/contacto libres (IS NULL, no solo falsy) y consentimiento retirado.
  if (piiEliminada) {
    if (datos.tipo !== "consumidor") {
      return {
        ok: false,
        mensaje: "Solo un contacto de tipo consumidor puede anonimizarse.",
      };
    }

    if (tieneVianderaId) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede seguir vinculado a una viandera.",
      };
    }

    if (tieneInteresadoId) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede seguir vinculado a una interesada.",
      };
    }

    if (tieneNombreLibre) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede conservar un nombre.",
      };
    }

    if (tieneContactoLibre) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede conservar un contacto.",
      };
    }

    if (datos.consentimientoRetiradoEn == null) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado debe tener el consentimiento retirado.",
      };
    }
  }

  return { ok: true };
}
