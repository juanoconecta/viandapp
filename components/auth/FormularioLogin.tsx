"use client";

import { useActionState } from "react";
import Link from "next/link";
import { iniciarSesion, iniciarSesionConGoogle, type EstadoAuth } from "@/app/auth/actions";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";

const estadoInicial: EstadoAuth = { status: "idle" };

export default function FormularioLogin({ redirectTo }: { redirectTo: string }) {
  const [estado, formAction] = useActionState(iniciarSesion, estadoInicial);

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirect" value={redirectTo} />

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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink/80">
            Contraseña
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

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        <BotonEnviar label="Iniciar sesión" labelEnviando="Entrando..." />
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink/10" />
        <span className="text-xs text-ink/40">o</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>

      <form action={iniciarSesionConGoogle}>
        <input type="hidden" name="redirect" value={redirectTo} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-card"
        >
          Continuar con Google
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-medium text-coral hover:text-coral-600">
          Registrate
        </Link>
      </p>
    </div>
  );
}
