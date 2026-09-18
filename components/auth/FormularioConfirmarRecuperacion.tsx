"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmarRecuperacion, type EstadoAuth } from "@/app/auth/actions";
import BotonEnviar from "@/components/ui/BotonEnviar";

const estadoInicial: EstadoAuth = { status: "idle" };

export default function FormularioConfirmarRecuperacion({
  tokenHash,
  redirectTo,
}: {
  tokenHash: string;
  redirectTo: string;
}) {
  const [estado, formAction] = useActionState(confirmarRecuperacion, estadoInicial);

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="tokenHash" value={tokenHash} />
        <input type="hidden" name="redirect" value={redirectTo} />

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        <BotonEnviar label="Confirmar" labelEnviando="Confirmando..." />
      </form>

      {estado.status === "error" && (
        <p className="mt-6 text-center text-sm text-ink/60">
          <Link href="/auth/recuperar" className="font-medium text-coral hover:text-coral-600">
            Pedir un link nuevo
          </Link>
        </p>
      )}
    </div>
  );
}
