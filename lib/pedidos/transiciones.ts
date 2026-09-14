import type { EstadoPedido } from "@/types";

const TRANSICIONES_VENDEDORA: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  generado: ["confirmado", "rechazado"],
};

export function transicionValidaPedido(
  desde: EstadoPedido,
  hacia: EstadoPedido,
): boolean {
  return (TRANSICIONES_VENDEDORA[desde] ?? []).includes(hacia);
}
