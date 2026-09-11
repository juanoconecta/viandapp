"use client";

import { useActionState } from "react";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { crearTarea, type ResultadoAccion } from "@/app/admin/crm/actions";

const ESTADO_INICIAL: ResultadoAccion = { status: "idle" };

export default function FormularioTarea({ contactoId }: { contactoId: string }) {
  const [estado, formAction] = useActionState(crearTarea, ESTADO_INICIAL);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="contactoId" value={contactoId} />

      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <label htmlFor="crm-tarea-titulo" className="text-sm font-medium text-ink/80">
          Nueva tarea
        </label>
        <input
          id="crm-tarea-titulo"
          name="titulo"
          type="text"
          required
          maxLength={200}
          placeholder="Ej. Llamar para confirmar"
          className="min-h-11 rounded-xl border border-ink/15 bg-paper px-3.5 py-2 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="crm-tarea-vence" className="text-sm font-medium text-ink/80">
          Vence (opcional)
        </label>
        <input
          id="crm-tarea-vence"
          name="venceEn"
          type="date"
          className="min-h-11 rounded-xl border border-ink/15 bg-paper px-3.5 py-2 text-sm text-ink transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25"
        />
      </div>

      {estado.status === "error" && (
        <p className="w-full text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="w-full text-sm text-teal-700" role="status">
          Tarea creada.
        </p>
      )}

      <div>
        <BotonEnviar label="Crear tarea" labelEnviando="Creando..." />
      </div>
    </form>
  );
}
