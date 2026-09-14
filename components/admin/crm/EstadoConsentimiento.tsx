import type { TipoCrmContacto } from "@/types";

type Props = {
  tipo: TipoCrmContacto;
  piiEliminada: boolean;
  consentimientoRetiradoEn: string | null;
};

/**
 * Solo tiene sentido para consumidores (el único tipo con consentimiento de
 * marketing que retirar/anonimizar) — cocinas y aliados nunca muestran esto,
 * por eso el guard temprano devuelve `null` en vez de un estado vacío.
 */
export function EstadoConsentimiento({
  tipo,
  piiEliminada,
  consentimientoRetiradoEn,
}: Props) {
  if (tipo !== "consumidor") return null;

  if (piiEliminada) {
    return (
      <span className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium italic text-ink/40">
        Datos anonimizados
      </span>
    );
  }

  if (consentimientoRetiradoEn) {
    return (
      <span className="rounded-full bg-ink/10 px-2.5 py-1 text-xs font-medium text-ink/50">
        Consentimiento retirado
      </span>
    );
  }

  return (
    <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700">
      Consentimiento vigente
    </span>
  );
}
