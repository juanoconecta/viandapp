export type EstadoAdhesionPuni =
  | "pendiente"
  | "aprobada"
  | "rechazada"
  | "suspendida"
  | "revocada";

type Quien = "admin" | "viandera";

const TRANSICIONES_ADMIN: Partial<Record<EstadoAdhesionPuni, EstadoAdhesionPuni[]>> = {
  pendiente: ["aprobada", "rechazada"],
  aprobada: ["suspendida", "revocada"],
  suspendida: ["aprobada", "revocada"],
};

const TRANSICIONES_VIANDERA: Partial<Record<EstadoAdhesionPuni, EstadoAdhesionPuni[]>> = {
  rechazada: ["pendiente"],
  revocada: ["pendiente"],
};

export function transicionValida(
  desde: EstadoAdhesionPuni,
  hacia: EstadoAdhesionPuni,
  quien: Quien,
): boolean {
  const tabla = quien === "admin" ? TRANSICIONES_ADMIN : TRANSICIONES_VIANDERA;
  return (tabla[desde] ?? []).includes(hacia);
}
