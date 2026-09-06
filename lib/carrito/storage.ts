import {
  CLAVE_CARRITO,
  parsearCarrito,
  serializarCarrito,
  type CarritoAlmacenado,
} from "./estado";

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
