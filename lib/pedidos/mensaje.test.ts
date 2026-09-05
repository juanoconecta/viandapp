import { describe, expect, it } from "vitest";
import { construirMensajePedido } from "./mensaje";

describe("construirMensajePedido", () => {
  it("construye literalmente el mensaje de envio con los datos normalizados y el total autoritativo", () => {
    expect(
      construirMensajePedido({
        vianderaNombre: "  Cocina de Ana  ",
        nombreComprador: "  Lucía Pérez  ",
        modalidad: "envio_propio",
        direccionEnvio: "  Av. Siempre Viva 123  ",
        costoEnvio: 600,
        total: 9999,
        items: [
          { nombre: "Milanesa con puré", precioCapturado: 4200, cantidad: 2 },
          { nombre: "Empanada", precioCapturado: 1800, cantidad: 1 },
        ],
      }),
    ).toBe(
      "Hola Cocina de Ana, soy Lucía Pérez. Quiero hacer este pedido:\n\n" +
        "• 2 x Milanesa con puré — $ 8.400,00\n" +
        "• 1 x Empanada — $ 1.800,00\n\n" +
        "Modalidad: Envío de la cocina\n" +
        "Dirección: Av. Siempre Viva 123\n" +
        "Envío: $ 600,00\n" +
        "Total: $ 9.999,00\n\n" +
        "Pedido generado desde viandapp.ar.",
    );
  });

  it("omite la direccion para retiro aunque se haya recibido una", () => {
    expect(
      construirMensajePedido({
        vianderaNombre: "Cocina de Ana",
        nombreComprador: "Lucía",
        modalidad: "retiro",
        direccionEnvio: "Av. Siempre Viva 123",
        costoEnvio: 0,
        total: 4200,
        items: [{ nombre: "Milanesa", precioCapturado: 4200, cantidad: 1 }],
      }),
    ).toBe(
      "Hola Cocina de Ana, soy Lucía. Quiero hacer este pedido:\n\n" +
        "• 1 x Milanesa — $ 4.200,00\n\n" +
        "Modalidad: Retiro en la cocina\n" +
        "Envío: $ 0,00\n" +
        "Total: $ 4.200,00\n\n" +
        "Pedido generado desde viandapp.ar.",
    );
  });

  it("nombra envio con Puni", () => {
    expect(
      construirMensajePedido({
        vianderaNombre: "Cocina",
        nombreComprador: "Comprador",
        modalidad: "envio_puni",
        direccionEnvio: "Calle 1",
        costoEnvio: 0,
        total: 0,
        items: [{ nombre: "Sopa", precioCapturado: 0, cantidad: 1 }],
      }),
    ).toContain("Modalidad: Envío con Puni");
  });

  it.each([
    ["nombre de cocina vacio", { vianderaNombre: "  " }],
    ["nombre de comprador vacio", { nombreComprador: "  " }],
    ["lista de items vacia", { items: [] }],
    ["direccion ausente para envio", { modalidad: "envio_puni", direccionEnvio: null }],
    ["direccion vacia para envio", { modalidad: "envio_propio", direccionEnvio: "  " }],
    ["costo de envio negativo", { costoEnvio: -1 }],
    ["total no finito", { total: Infinity }],
    ["precio de item negativo", { items: [{ nombre: "Sopa", precioCapturado: -1, cantidad: 1 }] }],
    ["cantidad cero", { items: [{ nombre: "Sopa", precioCapturado: 1, cantidad: 0 }] }],
    ["cantidad fraccionaria", { items: [{ nombre: "Sopa", precioCapturado: 1, cantidad: 1.5 }] }],
  ])("rechaza %s", (_caso, parcial) => {
    expect(() =>
      construirMensajePedido({
        vianderaNombre: "Cocina",
        nombreComprador: "Comprador",
        modalidad: "retiro",
        direccionEnvio: null,
        costoEnvio: 0,
        total: 1,
        items: [{ nombre: "Sopa", precioCapturado: 1, cantidad: 1 }],
        ...parcial,
      }),
    ).toThrow();
  });
});
