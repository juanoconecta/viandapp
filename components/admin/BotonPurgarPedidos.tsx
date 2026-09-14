"use client";

import { useActionState } from "react";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { purgarPedidosVencidos, type ResultadoPurgarPedidos } from "@/app/admin/actions";

export default function BotonPurgarPedidos() {
  const [estado, formAction] = useActionState<ResultadoPurgarPedidos, FormData>(
    purgarPedidosVencidos,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <BotonEnviar label="Purgar pedidos vencidos" labelEnviando="Purgando..." />
      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">{estado.mensaje}</p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">{estado.mensaje}</p>
      )}
    </form>
  );
}
