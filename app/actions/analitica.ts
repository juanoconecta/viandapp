"use server";

import { registrarEvento, type EventoPublico } from "@/lib/analitica/eventos";

export async function registrarEventoAnalitica(
  evento: EventoPublico,
): Promise<void> {
  await registrarEvento(evento);
}
