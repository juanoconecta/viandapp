"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { invitarViandera, type EstadoInvitacion } from "@/app/admin/actions";

const campoClase =
  "rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

function BotonInvitar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Invitando..." : "Invitar"}
    </button>
  );
}

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
        <BotonInvitar />
      </div>
    </form>
  );
}
