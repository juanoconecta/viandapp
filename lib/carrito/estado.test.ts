import { describe, expect, it } from "vitest";
import {
  agregarPlato,
  decrementarPlato,
  incrementarPlato,
  parsearCarrito,
  reemplazarCarrito,
  serializarCarrito,
  establecerCantidad,
  mismoContenidoCarrito,
  vaciarCarrito,
} from "./estado";

const COCINA = "11111111-1111-4111-8111-111111111111";
const OTRA_COCINA = "22222222-2222-4222-8222-222222222222";
const PLATO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLATO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("persistencia del carrito", () => {
  it("hace round-trip guardando solamente cocina, ids y cantidades", () => {
    const carrito = {
      vianderaId: COCINA,
      items: [{ platoId: PLATO_A, cantidad: 2 }],
    };

    expect(parsearCarrito(serializarCarrito(carrito))).toEqual(carrito);
    expect(serializarCarrito(carrito)).toBe(
      `{"vianderaId":"${COCINA}","items":[{"platoId":"${PLATO_A}","cantidad":2}]}`,
    );
  });

  it.each([
    ["JSON roto", "{"],
    ["objeto nulo", "null"],
    ["carrito vacío", `{"vianderaId":"${COCINA}","items":[]}`],
    ["cocina no canónica", `{"vianderaId":"NO-UUID","items":[{"platoId":"${PLATO_A}","cantidad":1}]}`],
    ["plato duplicado", `{"vianderaId":"${COCINA}","items":[{"platoId":"${PLATO_A}","cantidad":1},{"platoId":"${PLATO_A}","cantidad":2}]}`],
    ["plato no canónico", `{"vianderaId":"${COCINA}","items":[{"platoId":"${PLATO_A.toUpperCase()}","cantidad":1}]}`],
    ["cantidad cero", `{"vianderaId":"${COCINA}","items":[{"platoId":"${PLATO_A}","cantidad":0}]}`],
    ["cantidad decimal", `{"vianderaId":"${COCINA}","items":[{"platoId":"${PLATO_A}","cantidad":1.5}]}`],
    ["cantidad mayor a 50", `{"vianderaId":"${COCINA}","items":[{"platoId":"${PLATO_A}","cantidad":51}]}`],
    [
      "más de 50 platos",
      JSON.stringify({
        vianderaId: COCINA,
        items: Array.from({ length: 51 }, (_, indice) => ({
          platoId: `00000000-0000-4000-8000-${String(indice).padStart(12, "0")}`,
          cantidad: 1,
        })),
      }),
    ],
  ])("convierte %s en carrito vacío sin lanzar", (_caso, valor) => {
    expect(parsearCarrito(valor)).toBeNull();
  });
});

describe("operaciones inmutables", () => {
  it("agrega e incrementa platos de la misma cocina sin mutar el origen", () => {
    const original = { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }] };
    const agregado = agregarPlato(original, COCINA, PLATO_B);
    const incrementado = incrementarPlato(original, PLATO_A);

    expect(agregado).toEqual({
      tipo: "actualizado",
      carrito: { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }, { platoId: PLATO_B, cantidad: 1 }] },
    });
    expect(incrementado).toEqual({ vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 2 }] });
    expect(original).toEqual({ vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }] });
  });

  it("exige reemplazo explícito cuando cambia la cocina", () => {
    const original = { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }] };
    const resultado = agregarPlato(original, OTRA_COCINA, PLATO_B);

    expect(resultado).toEqual({ tipo: "requiere_reemplazo", vianderaId: OTRA_COCINA, platoId: PLATO_B });
    expect(reemplazarCarrito(OTRA_COCINA, PLATO_B)).toEqual({
      vianderaId: OTRA_COCINA,
      items: [{ platoId: PLATO_B, cantidad: 1 }],
    });
  });

  it("decrementa quitando en cero y establece cantidades dentro del límite", () => {
    const carrito = { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }, { platoId: PLATO_B, cantidad: 3 }] };

    expect(decrementarPlato(carrito, PLATO_A)).toEqual({ vianderaId: COCINA, items: [{ platoId: PLATO_B, cantidad: 3 }] });
    expect(establecerCantidad(carrito, PLATO_B, 50)).toEqual({ vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }, { platoId: PLATO_B, cantidad: 50 }] });
    expect(() => establecerCantidad(carrito, PLATO_B, 51)).toThrow("cantidad");
  });

  it("no agrega un plato 51 ni incrementa una cantidad mayor a 50", () => {
    const lleno = {
      vianderaId: COCINA,
      items: Array.from({ length: 50 }, (_, indice) => ({
        platoId: `00000000-0000-4000-8000-${String(indice).padStart(12, "0")}`,
        cantidad: 1,
      })),
    };
    expect(agregarPlato(lleno, COCINA, PLATO_A)).toEqual({ tipo: "limite_alcanzado" });
    expect(() => incrementarPlato({ vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 50 }] }, PLATO_A)).toThrow("50");
  });

  it("solo considera igual un carrito con la misma cocina, platos y cantidades", () => {
    const esperado = { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 2 }, { platoId: PLATO_B, cantidad: 1 }] };
    expect(mismoContenidoCarrito(esperado, { vianderaId: COCINA, items: [...esperado.items].reverse() })).toBe(true);
    expect(mismoContenidoCarrito(esperado, { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 3 }] })).toBe(false);
    expect(mismoContenidoCarrito(esperado, null)).toBe(false);
  });

  it("vacía el carrito sin mutar su contenido", () => {
    const original = { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }] };
    expect(vaciarCarrito(original)).toBeNull();
    expect(original.items).toHaveLength(1);
  });
});
