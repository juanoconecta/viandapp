"use client";

import { useActionState } from "react";
import { actualizarContrasena, type EstadoAuth } from "@/app/auth/actions";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";

const estadoInicial: EstadoAuth = { status: "idle" };

export default function FormularioActualizarPassword() {
  const [estado, formAction] = useActionState(actualizarContrasena, estadoInicial);

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink/80">
            Contraseña nueva
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className={campoClase}
            placeholder="••••••••"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="repetirPassword" className="text-sm font-medium text-ink/80">
            Repetí la contraseña
          </label>
          <input
            id="repetirPassword"
            name="repetirPassword"
            type="password"
            required
            className={campoClase}
            placeholder="••••••••"
          />
        </div>

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        <BotonEnviar label="Guardar contraseña" labelEnviando="Guardando..." />
      </form>
    </div>
  );
}
