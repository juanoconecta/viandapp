"use client";

import { useActionState } from "react";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { agregarNota, type ResultadoAccion } from "@/app/admin/crm/actions";

const ESTADO_INICIAL: ResultadoAccion = { status: "idle" };

export default function FormularioNota({ contactoId }: { contactoId: string }) {
  const [estado, formAction] = useActionState(agregarNota, ESTADO_INICIAL);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-card p-4"
    >
      <input type="hidden" name="contactoId" value={contactoId} />

      <p className="text-xs text-ink/50">
        No incluyas datos sensibles que no sean necesarios para la gestión comercial.
      </p>

      <label htmlFor="crm-nota-texto" className="sr-only">
        Nueva nota
      </label>
      <textarea
        id="crm-nota-texto"
        name="texto"
        rows={3}
        maxLength={2000}
        required
        placeholder="Agregar una nota..."
        className="rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25"
      />

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Nota guardada.
        </p>
      )}

      <div>
        <BotonEnviar label="Agregar nota" labelEnviando="Guardando..." />
      </div>
    </form>
  );
}
