import { describe, expect, it } from "vitest";
import {
  crearStorageMemoria,
  leerCarritoSeguro,
  persistirCarritoSeguro,
  resolverStorageSeguro,
} from "./storage";
import { CLAVE_CARRITO } from "./estado";

const carrito = {
  vianderaId: "11111111-1111-4111-8111-111111111111",
  items: [{ platoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", cantidad: 2 }],
};

describe("adaptador acotado de localStorage", () => {
  it("hidrata a vacío si getItem lanza", () => {
    expect(leerCarritoSeguro({ getItem: () => { throw new Error("denegado"); } })).toBeNull();
  });

  it("mantiene el flujo si setItem o removeItem lanzan", () => {
    expect(() => persistirCarritoSeguro({
      setItem: () => { throw new Error("cuota"); },
      removeItem: () => undefined,
    }, carrito)).not.toThrow();
    expect(() => persistirCarritoSeguro({
      setItem: () => undefined,
      removeItem: () => { throw new Error("denegado"); },
    }, null)).not.toThrow();
  });

  it("usa exclusivamente la clave pública del carrito", () => {
    const claves: string[] = [];
    persistirCarritoSeguro({
      setItem: (clave) => { claves.push(clave); },
      removeItem: (clave) => { claves.push(clave); },
    }, carrito);
    expect(claves).toEqual([CLAVE_CARRITO]);
  });

  it("usa un respaldo en memoria si falla el getter de la propiedad Storage", () => {
    const respaldo = crearStorageMemoria();
    respaldo.setItem("clave", "valor");
    const resuelto = resolverStorageSeguro(() => {
      throw new DOMException("Acceso denegado", "SecurityError");
    }, respaldo);

    expect(resuelto).toBe(respaldo);
    expect(resuelto.getItem("clave")).toBe("valor");
  });
});
