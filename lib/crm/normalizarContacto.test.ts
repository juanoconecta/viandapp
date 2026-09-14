import { describe, expect, it } from "vitest";
import { normalizarContacto } from "./normalizarContacto";

describe("normalizarContacto", () => {
  it.each([
    [null, null],
    ["", null],
    ["sin telefono", null],
    [" Maria@Ejemplo.COM ", "maria@ejemplo.com"],
    ["3548 635151", "3548635151"],
    ["+54 3548 635151", "3548635151"],
    ["+54 9 3548-635151", "3548635151"],
    ["11-2345", "112345"],
  ])("normaliza %s", (entrada, esperado) => {
    expect(normalizarContacto(entrada)).toBe(esperado);
  });
});
