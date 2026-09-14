export const CLAVE_CARRITO = "viandapp_carrito_v1";
export const MAX_ITEMS_CARRITO = 50;
export const MAX_CANTIDAD_ITEM = 50;

const UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type ItemCarrito = { platoId: string; cantidad: number };
export type CarritoAlmacenado = { vianderaId: string; items: ItemCarrito[] };

export type ResultadoAgregar =
  | { tipo: "actualizado"; carrito: CarritoAlmacenado }
  | { tipo: "requiere_reemplazo"; vianderaId: string; platoId: string }
  | { tipo: "limite_alcanzado" };

export function esUuidCanonico(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_CANONICO.test(valor);
}

export function parsearCarrito(valor: string | null): CarritoAlmacenado | null {
  if (!valor) return null;

  try {
    const candidato: unknown = JSON.parse(valor);
    if (!candidato || typeof candidato !== "object") return null;
    const carrito = candidato as Partial<CarritoAlmacenado>;
    if (!esUuidCanonico(carrito.vianderaId)) return null;
    if (!Array.isArray(carrito.items) || carrito.items.length < 1 || carrito.items.length > MAX_ITEMS_CARRITO) return null;

    const ids = new Set<string>();
    for (const item of carrito.items) {
      if (
        !item ||
        typeof item !== "object" ||
        !esUuidCanonico(item.platoId) ||
        !Number.isInteger(item.cantidad) ||
        item.cantidad < 1 ||
        item.cantidad > MAX_CANTIDAD_ITEM ||
        ids.has(item.platoId)
      ) return null;
      ids.add(item.platoId);
    }

    return {
      vianderaId: carrito.vianderaId,
      items: carrito.items.map(({ platoId, cantidad }) => ({ platoId, cantidad })),
    };
  } catch {
    return null;
  }
}

export function serializarCarrito(carrito: CarritoAlmacenado): string {
  return JSON.stringify({
    vianderaId: carrito.vianderaId,
    items: carrito.items.map(({ platoId, cantidad }) => ({ platoId, cantidad })),
  });
}

function exigirCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD_ITEM) {
    throw new Error("La cantidad debe ser un entero entre 1 y 50.");
  }
}

export function agregarPlato(
  carrito: CarritoAlmacenado | null,
  vianderaId: string,
  platoId: string,
): ResultadoAgregar {
  if (!carrito) return { tipo: "actualizado", carrito: reemplazarCarrito(vianderaId, platoId) };
  if (carrito.vianderaId !== vianderaId) return { tipo: "requiere_reemplazo", vianderaId, platoId };

  const existente = carrito.items.find((item) => item.platoId === platoId);
  if (existente) return { tipo: "actualizado", carrito: incrementarPlato(carrito, platoId) };
  if (carrito.items.length >= MAX_ITEMS_CARRITO) return { tipo: "limite_alcanzado" };

  return {
    tipo: "actualizado",
    carrito: { ...carrito, items: [...carrito.items, { platoId, cantidad: 1 }] },
  };
}

export function reemplazarCarrito(vianderaId: string, platoId: string): CarritoAlmacenado {
  return { vianderaId, items: [{ platoId, cantidad: 1 }] };
}

export function establecerCantidad(
  carrito: CarritoAlmacenado,
  platoId: string,
  cantidad: number,
): CarritoAlmacenado {
  exigirCantidad(cantidad);
  return {
    ...carrito,
    items: carrito.items.map((item) => item.platoId === platoId ? { ...item, cantidad } : item),
  };
}

export function incrementarPlato(carrito: CarritoAlmacenado, platoId: string): CarritoAlmacenado {
  const item = carrito.items.find((actual) => actual.platoId === platoId);
  if (!item) return carrito;
  return establecerCantidad(carrito, platoId, item.cantidad + 1);
}

export function decrementarPlato(carrito: CarritoAlmacenado, platoId: string): CarritoAlmacenado | null {
  const item = carrito.items.find((actual) => actual.platoId === platoId);
  if (!item) return carrito;
  if (item.cantidad > 1) return establecerCantidad(carrito, platoId, item.cantidad - 1);
  const items = carrito.items.filter((actual) => actual.platoId !== platoId);
  return items.length > 0 ? { ...carrito, items } : null;
}

export function cantidadTotal(carrito: CarritoAlmacenado | null): number {
  return carrito?.items.reduce((total, item) => total + item.cantidad, 0) ?? 0;
}

export function vaciarCarrito(carrito: CarritoAlmacenado | null): null {
  void carrito;
  return null;
}

export function mismoContenidoCarrito(
  primero: CarritoAlmacenado | null,
  segundo: CarritoAlmacenado | null,
): boolean {
  if (!primero || !segundo || primero.vianderaId !== segundo.vianderaId || primero.items.length !== segundo.items.length) return false;
  const cantidades = new Map(primero.items.map((item) => [item.platoId, item.cantidad]));
  return segundo.items.every((item) => cantidades.get(item.platoId) === item.cantidad);
}
