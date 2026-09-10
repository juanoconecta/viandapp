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
  // At least one of: vianderaId, interesadoId, nombreLibre, or piiEliminada must be set/true
  const tieneVianderaId = Boolean(datos.vianderaId);
  const tieneInteresadoId = Boolean(datos.interesadoId);
  const tieneNombreLibre = Boolean(datos.nombreLibre);
  const piiEliminada = datos.piiEliminada === true;

  // Reject two FKs simultaneously
  if (tieneVianderaId && tieneInteresadoId) {
    return {
      ok: false,
      mensaje: "No se pueden establecer dos FKs simultáneamente: especifique solo vianderaId o interesadoId",
    };
  }

  // Check if we have at least one valid field per constraint 1
  const tieneAlmenosUno = tieneVianderaId || tieneInteresadoId || tieneNombreLibre || piiEliminada;
  if (!tieneAlmenosUno) {
    return {
      ok: false,
      mensaje: "El contacto debe tener al menos un vínculo: vianderaId, interesadoId, nombreLibre, o estar anonimizado",
    };
  }

  // Constraint 2: crm_contactos_anonimizacion_consistente
  // If piiEliminada = true, then tipo must be 'consumidor', no FKs, no nombreLibre, no contactoLibre, and consentimiento must be set
  if (piiEliminada) {
    if (datos.tipo !== "consumidor") {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado solo puede ser de tipo 'consumidor'",
      };
    }

    if (tieneVianderaId) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede tener vianderaId",
      };
    }

    if (tieneInteresadoId) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede tener interesadoId",
      };
    }

    if (tieneNombreLibre) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede tener nombreLibre",
      };
    }

    if (datos.contactoLibre) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado no puede tener contactoLibre",
      };
    }

    if (!datos.consentimientoRetiradoEn) {
      return {
        ok: false,
        mensaje: "Un contacto anonimizado debe tener consentimiento retirado",
      };
    }
  }

  return { ok: true };
}
