import { describe, expect, it } from "vitest";
import { debeLimitar, ventanaActual } from "./limiteAbuso";

describe("debeLimitar", () => {
  it("con limite 5: las primeras 5 solicitudes se permiten, la 6a se bloquea", () => {
    expect(debeLimitar(1, 5)).toBe(false);
    expect(debeLimitar(4, 5)).toBe(false);
    expect(debeLimitar(5, 5)).toBe(false);
    expect(debeLimitar(6, 5)).toBe(true);
  });
});

describe("ventanaActual", () => {
  it("trunca una fecha al inicio de la ventana de N minutos", () => {
    const fecha = new Date("2026-09-04T10:07:32Z");
    expect(ventanaActual(fecha, 5).toISOString()).toBe("2026-09-04T10:05:00.000Z");
  });
});
