import { describe, expect, it } from "vitest";
import { construirUrlCheckout, parsearCheckout } from "./checkout";

const COCINA = "11111111-1111-4111-8111-111111111111";
const PLATO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLATO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("handoff al checkout", () => {
  it("serializa los platos ordenados y sin datos de presentación o comprador", () => {
    const url = construirUrlCheckout({
      vianderaId: COCINA,
      items: [{ platoId: PLATO_B, cantidad: 1 }, { platoId: PLATO_A, cantidad: 2 }],
    });

    expect(url).toBe(`/pedido?cocina=${COCINA}&items=${PLATO_A}%3A2%2C${PLATO_B}%3A1`);
    expect(url).not.toMatch(/precio|nombre|telefono|direccion/i);
  });

  it("parsea el formato canónico", () => {
    expect(parsearCheckout(COCINA, `${PLATO_A}:2,${PLATO_B}:1`)).toEqual({
      vianderaId: COCINA,
      items: [{ platoId: PLATO_A, cantidad: 2 }, { platoId: PLATO_B, cantidad: 1 }],
    });
  });

  it.each([
    ["cocina ausente", undefined, `${PLATO_A}:1`],
    ["items vacíos", COCINA, ""],
    ["inyección", COCINA, `${PLATO_A}:1<script>`],
    ["duplicados", COCINA, `${PLATO_A}:1,${PLATO_A}:2`],
    ["cantidad decimal", COCINA, `${PLATO_A}:1.5`],
    ["cantidad con cero inicial", COCINA, `${PLATO_A}:01`],
    ["cantidad fuera de rango", COCINA, `${PLATO_A}:51`],
    ["campos extra", COCINA, `${PLATO_A}:1:2`],
  ])("rechaza %s", (_caso, cocina, items) => {
    expect(parsearCheckout(cocina, items)).toBeNull();
  });

  it("rechaza más de 50 platos en la URL", () => {
    const items = Array.from({ length: 51 }, (_, indice) => `00000000-0000-4000-8000-${String(indice).padStart(12, "0")}:1`).join(",");
    expect(parsearCheckout(COCINA, items)).toBeNull();
  });
});
