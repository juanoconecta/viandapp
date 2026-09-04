import type { EstadoAdhesionPuni } from "./transiciones";

export type Modalidad = "retiro" | "envio_propio" | "envio_puni";

type VianderaEnvio = {
  ofrece_retiro: boolean;
  ofrece_envio: boolean;
  costo_envio_propio: number | null;
};

type AdhesionResumen = {
  estado: EstadoAdhesionPuni;
  costo_envio_puni: number | null;
} | null;

export function costoEnvioVigente(
  modalidad: Modalidad,
  viandera: VianderaEnvio,
  adhesion: AdhesionResumen,
): number | null {
  if (modalidad === "retiro") return 0;
  if (modalidad === "envio_propio") return viandera.costo_envio_propio;
  return adhesion?.costo_envio_puni ?? null;
}

export function modalidadesDisponibles(
  viandera: VianderaEnvio,
  adhesion: AdhesionResumen,
): Modalidad[] {
  const candidatas: Modalidad[] = [];
  if (viandera.ofrece_retiro) candidatas.push("retiro");
  if (viandera.ofrece_envio) candidatas.push("envio_propio");
  if (adhesion?.estado === "aprobada") candidatas.push("envio_puni");

  return candidatas.filter(
    (modalidad) => costoEnvioVigente(modalidad, viandera, adhesion) !== null,
  );
}
