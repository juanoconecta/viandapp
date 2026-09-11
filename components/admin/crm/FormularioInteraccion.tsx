"use client";

import { useActionState } from "react";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { registrarInteraccion, type ResultadoAccion } from "@/app/admin/crm/actions";
import type { TipoCrmInteraccion } from "@/types";

const ESTADO_INICIAL: ResultadoAccion = { status: "idle" };

const ETIQUETA_TIPO_INTERACCION: Record<TipoCrmInteraccion, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  email: "Email",
  reunion: "Reunión",
  cambio_estado: "Cambio de estado",
  otro: "Otro",
};

const TIPOS_INTERACCION = Object.keys(
  ETIQUETA_TIPO_INTERACCION,
) as TipoCrmInteraccion[];

export default function FormularioInteraccion({ contactoId }: { contactoId: string }) {
  const [estado, formAction] = useActionState(registrarInteraccion, ESTADO_INICIAL);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-card p-4"
    >
      <input type="hidden" name="contactoId" value={contactoId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="crm-interaccion-tipo" className="text-sm font-medium text-ink/80">
          Tipo de interacción
        </label>
        <select
          id="crm-interaccion-tipo"
          name="tipo"
          required
          defaultValue="whatsapp"
          className="min-h-11 rounded-xl border border-ink/15 bg-paper px-3.5 py-2 text-sm text-ink transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25"
        >
          {TIPOS_INTERACCION.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETA_TIPO_INTERACCION[tipo]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-ink/50">
        No incluyas datos sensibles que no sean necesarios para la gestión comercial.
      </p>

      <label htmlFor="crm-interaccion-resumen" className="sr-only">
        Resumen de la interacción
      </label>
      <textarea
        id="crm-interaccion-resumen"
        name="resumen"
        rows={3}
        maxLength={1000}
        required
        placeholder="¿Qué se conversó?"
        className="rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25"
      />

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Interacción registrada.
        </p>
      )}

      <div>
        <BotonEnviar label="Registrar interacción" labelEnviando="Guardando..." />
      </div>
    </form>
  );
}
