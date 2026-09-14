import type { CarritoAlmacenado } from "./estado";

export const CLAVE_SESION_CHECKOUT = "viandapp_checkout_key_v1";
const UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type AlmacenamientoSesion = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function fingerprintCheckout(carrito: CarritoAlmacenado): string {
  const items = [...carrito.items]
    .sort((a, b) => a.platoId.localeCompare(b.platoId))
    .map((item) => `${item.platoId}:${item.cantidad}`)
    .join(",");
  return `${carrito.vianderaId}|${items}`;
}

export function obtenerClaveCheckout(
  carrito: CarritoAlmacenado,
  storage: AlmacenamientoSesion,
  generarUuid: () => string,
): string {
  const fingerprint = fingerprintCheckout(carrito);
  try {
    const guardado: unknown = JSON.parse(storage.getItem(CLAVE_SESION_CHECKOUT) ?? "null");
    if (guardado && typeof guardado === "object") {
      const sesion = guardado as { fingerprint?: unknown; idempotencyKey?: unknown };
      if (sesion.fingerprint === fingerprint && typeof sesion.idempotencyKey === "string" && UUID_CANONICO.test(sesion.idempotencyKey)) {
        return sesion.idempotencyKey;
      }
    }
  } catch {
    // Se reemplaza abajo por una sesión válida.
  }

  const idempotencyKey = generarUuid();
  if (!UUID_CANONICO.test(idempotencyKey)) throw new Error("No se pudo crear una clave de checkout válida.");
  storage.setItem(CLAVE_SESION_CHECKOUT, JSON.stringify({ fingerprint, idempotencyKey }));
  return idempotencyKey;
}

export function invalidarClaveCheckout(storage: AlmacenamientoSesion): void {
  storage.removeItem(CLAVE_SESION_CHECKOUT);
}
