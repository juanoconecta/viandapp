import { describe, expect, it } from "vitest";
import { calcularTotal, validarUnaSolaCocina } from "./total";

describe("calcularTotal", () => {
  it("suma precio por cantidad de cada item mas el envio", () => {
    const items = [
      { precioCapturado: 4200, cantidad: 2 },
      { precioCapturado: 2800, cantidad: 1 },
    ];
    expect(calcularTotal(items, 600)).toBe(4200 * 2 + 2800 + 600);
  });

  it("envio en cero es valido", () => {
    expect(calcularTotal([{ precioCapturado: 1000, cantidad: 1 }], 0)).toBe(1000);
  });

  it("lanza si la lista de items esta vacia", () => {
    expect(() => calcularTotal([], 0)).toThrow();
  });

  it("lanza si algun precio o cantidad es negativo", () => {
    expect(() => calcularTotal([{ precioCapturado: -1, cantidad: 1 }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: 0 }], 0)).toThrow();
  });

  it("respeta decimales de precio", () => {
    expect(calcularTotal([{ precioCapturado: 999.5, cantidad: 3 }], 0)).toBe(2998.5);
  });

  it("rechaza costoEnvio null, NaN o Infinity", () => {
    const items = [{ precioCapturado: 100, cantidad: 1 }];
    expect(() => calcularTotal(items, null as unknown as number)).toThrow();
    expect(() => calcularTotal(items, NaN)).toThrow();
    expect(() => calcularTotal(items, Infinity)).toThrow();
  });

  it("rechaza precioCapturado null, NaN o Infinity", () => {
    expect(() => calcularTotal([{ precioCapturado: null as unknown as number, cantidad: 1 }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: NaN, cantidad: 1 }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: Infinity, cantidad: 1 }], 0)).toThrow();
  });

  it("rechaza cantidad null, NaN o Infinity", () => {
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: null as unknown as number }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: NaN }], 0)).toThrow();
    expect(() => calcularTotal([{ precioCapturado: 100, cantidad: Infinity }], 0)).toThrow();
  });

  it("costo de envio 0 explicito sigue siendo valido junto a un precio 0", () => {
    expect(calcularTotal([{ precioCapturado: 0, cantidad: 1 }], 0)).toBe(0);
  });
});

describe("validarUnaSolaCocina", () => {
  it("true si todos los items son de la misma cocina", () => {
    expect(validarUnaSolaCocina([{ vianderaId: "a" }, { vianderaId: "a" }])).toBe(true);
  });

  it("false si hay mas de una cocina", () => {
    expect(validarUnaSolaCocina([{ vianderaId: "a" }, { vianderaId: "b" }])).toBe(false);
  });
});
