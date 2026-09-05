import { describe, expect, it } from "vitest";
import { prepararCheckout } from "./checkoutServidor";

const COCINA = "11111111-1111-4111-8111-111111111111";
const OTRA = "22222222-2222-4222-8222-222222222222";
const PLATO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLATO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const carrito = { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 2 }, { platoId: PLATO_B, cantidad: 1 }] };
const viandera = { id: COCINA, nombre: "Cocina Ana", slug: "cocina-ana", ofrece_retiro: true, ofrece_envio: true, costo_envio_propio: 900 };

describe("datos frescos del checkout", () => {
  it("mapea precio y nombre actuales y resuelve costos disponibles", () => {
    expect(prepararCheckout(carrito, viandera, [
      { id: PLATO_A, vianderas_id: COCINA, nombre: "Tarta", precio: 4200, disponible: true },
      { id: PLATO_B, vianderas_id: COCINA, nombre: "Sopa", precio: 3000, disponible: true },
    ], { estado: "aprobada", costo_envio_puni: 700 })).toEqual({
      estado: "listo",
      viandera: { id: COCINA, nombre: "Cocina Ana", slug: "cocina-ana" },
      items: [
        { platoId: PLATO_A, vianderaId: COCINA, nombre: "Tarta", precio: 4200, cantidad: 2 },
        { platoId: PLATO_B, vianderaId: COCINA, nombre: "Sopa", precio: 3000, cantidad: 1 },
      ],
      modalidades: [
        { id: "retiro", etiqueta: "Retiro", costo: 0 },
        { id: "envio_propio", etiqueta: "Envío de la cocina", costo: 900 },
        { id: "envio_puni", etiqueta: "Envío con Puni", costo: 700 },
      ],
    });
  });

  it("devuelve revisión si falta un plato, no está disponible o pertenece a otra cocina", () => {
    expect(prepararCheckout(carrito, viandera, [
      { id: PLATO_A, vianderas_id: OTRA, nombre: "Tarta", precio: 4200, disponible: true },
      { id: PLATO_B, vianderas_id: COCINA, nombre: "Sopa", precio: 3000, disponible: false },
    ], null)).toEqual({ estado: "revisar", slug: "cocina-ana", platosNoDisponibles: [PLATO_A, PLATO_B] });
  });

  it("rechaza todos los platos si la cocina consultada no coincide", () => {
    expect(prepararCheckout(
      { vianderaId: OTRA, items: [{ platoId: PLATO_A, cantidad: 1 }] },
      viandera,
      [{ id: PLATO_A, vianderas_id: OTRA, nombre: "Tarta", precio: 4200, disponible: true }],
      null,
    )).toEqual({ estado: "revisar", slug: "cocina-ana", platosNoDisponibles: [PLATO_A] });
  });

  it("no presenta modalidades cuyo costo es null como gratuitas", () => {
    const resultado = prepararCheckout(
      { vianderaId: COCINA, items: [{ platoId: PLATO_A, cantidad: 1 }] },
      { ...viandera, costo_envio_propio: null },
      [{ id: PLATO_A, vianderas_id: COCINA, nombre: "Tarta", precio: 4200, disponible: true }],
      { estado: "aprobada", costo_envio_puni: null },
    );
    expect(resultado).toMatchObject({ estado: "listo", modalidades: [{ id: "retiro", costo: 0 }] });
  });
});
