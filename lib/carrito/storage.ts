import {
  CLAVE_CARRITO,
  parsearCarrito,
  serializarCarrito,
  type CarritoAlmacenado,
} from "./estado";

export type StorageMinimo = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function crearStorageMemoria(): StorageMinimo {
  const valores = new Map<string, string>();
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => { valores.set(clave, valor); },
    removeItem: (clave) => { valores.delete(clave); },
  };
}

export function resolverStorageSeguro<T extends StorageMinimo>(
  obtener: () => T,
  respaldo: StorageMinimo,
): T | StorageMinimo {
  try {
    return obtener();
  } catch {
    return respaldo;
  }
}

export function leerCarritoSeguro(
  storage: Pick<Storage, "getItem">,
): CarritoAlmacenado | null {
  try {
    return parsearCarrito(storage.getItem(CLAVE_CARRITO));
  } catch {
    return null;
  }
}

export function persistirCarritoSeguro(
  storage: Pick<Storage, "setItem" | "removeItem">,
  carrito: CarritoAlmacenado | null,
): void {
  try {
    if (carrito) storage.setItem(CLAVE_CARRITO, serializarCarrito(carrito));
    else storage.removeItem(CLAVE_CARRITO);
  } catch {
    // El estado en memoria sigue siendo utilizable si el navegador bloquea storage.
  }
}
