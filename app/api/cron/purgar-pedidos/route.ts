import "server-only";
import { NextResponse } from "next/server";
import { ejecutarPurgado } from "@/lib/pedidos/servicioPurgado";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  // Corregido en esta revision: si CRON_SECRET no esta configurado,
  // rechaza -- nunca autoriza por ausencia/vacio del secreto.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await ejecutarPurgado();
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 500 });
  }

  return NextResponse.json({
    purgados: resultado.pedidosPurgados,
    limitadorLimpiado: resultado.contadoresLimpiados,
  });
}
