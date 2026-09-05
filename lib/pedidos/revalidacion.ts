import type { PedidoCambio } from "@/types";

export type ItemEsperado = {
  viandaId: string;
  nombreVisto: string;
  precioVisto: number;
};

export type ViandaRevalidada = {
  id: string;
  nombre: string;
  precio: number | null;
  disponible: boolean;
};

export function detectarCambios(
  items: ItemEsperado[],
  actuales: ViandaRevalidada[],
): PedidoCambio[] {
  const porId = new Map(actuales.map((vianda) => [vianda.id, vianda]));
  const cambios: PedidoCambio[] = [];

  for (const item of items) {
    const actual = porId.get(item.viandaId);
    if (!actual || !actual.disponible || actual.precio === null) {
      cambios.push({ tipo: "plato_no_disponible", vianda_id: item.viandaId });
    } else if (actual.precio !== item.precioVisto) {
      cambios.push({
        tipo: "precio_cambio",
        vianda_id: item.viandaId,
        precio_esperado: item.precioVisto,
        precio_actual: actual.precio,
      });
    }
  }

  return cambios;
}
