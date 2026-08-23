"use client";

import { useActionState } from "react";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { invitarViandera, type EstadoInvitacion } from "@/app/admin/actions";

export default function FormularioInvitar() {
  const [estado, formAction] = useActionState<EstadoInvitacion, FormData>(
    invitarViandera,
    { status: "idle" },
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium text-ink/80">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            className={campoClase}
            placeholder="Doña Rosa"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-ink/80">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={campoClase}
            placeholder="viandera@ejemplo.com"
          />
        </div>
      </div>

      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Invitación enviada.
        </p>
      )}

      <div>
        <BotonEnviar label="Invitar" labelEnviando="Invitando..." />
      </div>
    </form>
  );
}
