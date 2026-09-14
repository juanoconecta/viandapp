import {
  type CarritoAlmacenado,
  esUuidCanonico,
  MAX_CANTIDAD_ITEM,
  MAX_ITEMS_CARRITO,
} from "./estado";

export function construirUrlCheckout(carrito: CarritoAlmacenado): string {
  const items = [...carrito.items]
    .sort((a, b) => a.platoId.localeCompare(b.platoId))
    .map((item) => `${item.platoId}:${item.cantidad}`)
    .join(",");
  const parametros = new URLSearchParams({ cocina: carrito.vianderaId, items });
  return `/pedido?${parametros.toString()}`;
}

export function parsearCheckout(
  cocina: string | string[] | undefined,
  itemsCrudos: string | string[] | undefined,
): CarritoAlmacenado | null {
  if (typeof cocina !== "string" || !esUuidCanonico(cocina) || typeof itemsCrudos !== "string" || !itemsCrudos) return null;
  const partes = itemsCrudos.split(",");
  if (partes.length < 1 || partes.length > MAX_ITEMS_CARRITO) return null;

  const ids = new Set<string>();
  const items = [];
  for (const parte of partes) {
    const coincidencia = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([1-9][0-9]?)$/.exec(parte);
    if (!coincidencia) return null;
    const platoId = coincidencia[1];
    const cantidad = Number(coincidencia[2]);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD_ITEM || ids.has(platoId)) return null;
    ids.add(platoId);
    items.push({ platoId, cantidad });
  }

  return { vianderaId: cocina, items };
}
