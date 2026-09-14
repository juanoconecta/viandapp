import { describe, expect, it } from "vitest";
import { fingerprintCheckout, invalidarClaveCheckout, obtenerClaveCheckout } from "./sesionCheckout";

const COCINA = "11111111-1111-4111-8111-111111111111";
const PLATO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLATO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KEY_A = "33333333-3333-4333-8333-333333333333";
const KEY_B = "44444444-4444-4444-8444-444444444444";

function memoria(inicial?: string) {
  let valor = inicial ?? null;
  return {
    getItem: () => valor,
    setItem: (_clave: string, siguiente: string) => { valor = siguiente; },
    removeItem: () => { valor = null; },
    valor: () => valor,
  };
}

describe("sesión idempotente de checkout", () => {
  const carrito = { vianderaId: COCINA, items: [{ platoId: PLATO_B, cantidad: 1 }, { platoId: PLATO_A, cantidad: 2 }] };

  it("produce la misma huella aunque cambie el orden", () => {
    expect(fingerprintCheckout(carrito)).toBe(`${COCINA}|${PLATO_A}:2,${PLATO_B}:1`);
  });

  it("crea una clave canónica y la reutiliza para el mismo contenido", () => {
    const storage = memoria();
    let llamadas = 0;
    const generar = () => { llamadas += 1; return KEY_A; };

    expect(obtenerClaveCheckout(carrito, storage, generar)).toBe(KEY_A);
    expect(obtenerClaveCheckout(carrito, storage, generar)).toBe(KEY_A);
    expect(llamadas).toBe(1);
  });

  it("regenera al cambiar el carrito o encontrar almacenamiento malformado", () => {
    const storage = memoria("{roto");
    expect(obtenerClaveCheckout(carrito, storage, () => KEY_A)).toBe(KEY_A);
    const cambiado = { ...carrito, items: [{ platoId: PLATO_A, cantidad: 3 }] };
    expect(obtenerClaveCheckout(cambiado, storage, () => KEY_B)).toBe(KEY_B);
  });

  it("permite invalidar una clave antes de reintentar contenido cambiado", () => {
    const storage = memoria(JSON.stringify({ fingerprint: "x", idempotencyKey: KEY_A }));
    invalidarClaveCheckout(storage);
    expect(storage.valor()).toBeNull();
  });
});
