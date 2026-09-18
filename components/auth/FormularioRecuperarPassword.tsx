"use client";

import { useActionState } from "react";
import Link from "next/link";
import { solicitarRecuperacion, type EstadoAuth } from "@/app/auth/actions";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";

const estadoInicial: EstadoAuth = { status: "idle" };

export default function FormularioRecuperarPassword() {
  const [estado, formAction] = useActionState(solicitarRecuperacion, estadoInicial);

  if (estado.status === "verificar") {
    return (
      <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm text-ink/80" role="status">
          {estado.mensaje}
        </p>
        <p className="mt-6 text-center text-sm text-ink/60">
          <Link href="/login" className="font-medium text-coral hover:text-coral-600">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
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
            placeholder="vos@ejemplo.com"
          />
        </div>

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        <BotonEnviar label="Mandar link" labelEnviando="Enviando..." />
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        <Link href="/login" className="font-medium text-coral hover:text-coral-600">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
