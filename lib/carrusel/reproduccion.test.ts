import { describe, expect, it } from "vitest";
import {
  estadoInicial,
  indiceAnterior,
  reducirCarrusel,
  rotacionActiva,
  siguienteIndice,
  type EstadoCarrusel,
} from "./reproduccion";

describe("siguienteIndice", () => {
  it("avanza al siguiente índice", () => {
    expect(siguienteIndice(0, 4)).toBe(1);
    expect(siguienteIndice(2, 4)).toBe(3);
  });

  it("da la vuelta circularmente desde el último", () => {
    expect(siguienteIndice(3, 4)).toBe(0);
  });
});

describe("indiceAnterior", () => {
  it("retrocede al índice anterior", () => {
    expect(indiceAnterior(2, 4)).toBe(1);
  });

  it("da la vuelta circularmente desde el primero", () => {
    expect(indiceAnterior(0, 4)).toBe(3);
  });
});

describe("estadoInicial", () => {
  it("arranca en el índice 0 sin pausa temporal", () => {
    expect(estadoInicial(4, true)).toEqual({
      indice: 0,
      reproduciendo: true,
      pausadoTemporalmente: false,
    });
  });

  it("respeta el autoplay inicial en false (prefers-reduced-motion)", () => {
    expect(estadoInicial(4, false).reproduciendo).toBe(false);
  });
});

describe("rotacionActiva", () => {
  it("es true solo cuando reproduciendo y no hay pausa temporal", () => {
    expect(
      rotacionActiva({ indice: 0, reproduciendo: true, pausadoTemporalmente: false }),
    ).toBe(true);
  });

  it("es false si no está reproduciendo", () => {
    expect(
      rotacionActiva({ indice: 0, reproduciendo: false, pausadoTemporalmente: false }),
    ).toBe(false);
  });

  it("es false durante una pausa temporal, aunque reproduciendo sea true", () => {
    expect(
      rotacionActiva({ indice: 0, reproduciendo: true, pausadoTemporalmente: true }),
    ).toBe(false);
  });
});

describe("reducirCarrusel — TICK", () => {
  const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };

  it("avanza el índice cuando la rotación está activa", () => {
    const siguiente = reducirCarrusel(base, { tipo: "TICK" }, 4);
    expect(siguiente.indice).toBe(1);
  });

  it("no avanza si reproduciendo es false", () => {
    const pausado: EstadoCarrusel = { ...base, reproduciendo: false };
    expect(reducirCarrusel(pausado, { tipo: "TICK" }, 4)).toEqual(pausado);
  });

  it("no avanza durante una pausa temporal", () => {
    const enHover: EstadoCarrusel = { ...base, pausadoTemporalmente: true };
    expect(reducirCarrusel(enHover, { tipo: "TICK" }, 4)).toEqual(enHover);
  });
});

describe("reducirCarrusel — navegación manual", () => {
  const base: EstadoCarrusel = { indice: 0, reproduciendo: false, pausadoTemporalmente: false };

  it("SIGUIENTE avanza el índice aunque no esté reproduciendo", () => {
    expect(reducirCarrusel(base, { tipo: "SIGUIENTE" }, 4).indice).toBe(1);
  });

  it("ANTERIOR desde el índice 0 da la vuelta al último", () => {
    expect(reducirCarrusel(base, { tipo: "ANTERIOR" }, 4).indice).toBe(3);
  });

  it("IR_A cambia al índice pedido", () => {
    expect(reducirCarrusel(base, { tipo: "IR_A", indice: 2 }, 4).indice).toBe(2);
  });

  it("IR_A con índice fuera de rango no cambia el estado", () => {
    expect(reducirCarrusel(base, { tipo: "IR_A", indice: 9 }, 4)).toEqual(base);
    expect(reducirCarrusel(base, { tipo: "IR_A", indice: -1 }, 4)).toEqual(base);
  });
});

describe("reducirCarrusel — botón de reproducción persistente (WCAG 2.2.2)", () => {
  it("ALTERNAR_REPRODUCCION invierte reproduciendo sin tocar la pausa temporal", () => {
    const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
    expect(reducirCarrusel(base, { tipo: "ALTERNAR_REPRODUCCION" }, 4)).toEqual({
      ...base,
      reproduciendo: false,
    });
  });

  it("una pausa explícita persiste a través de hover/foco (no se revierte sola)", () => {
    const reproduciendo: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
    const pausadoPorBoton = reducirCarrusel(reproduciendo, { tipo: "ALTERNAR_REPRODUCCION" }, 4);
    const conHover = reducirCarrusel(pausadoPorBoton, { tipo: "INTERACCION_INICIO" }, 4);
    const sinHover = reducirCarrusel(conHover, { tipo: "INTERACCION_FIN" }, 4);
    expect(sinHover.reproduciendo).toBe(false);
    expect(rotacionActiva(sinHover)).toBe(false);
  });

  it("la rotación se reanuda al perder hover/foco si seguía reproduciendo", () => {
    const reproduciendo: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
    const conHover = reducirCarrusel(reproduciendo, { tipo: "INTERACCION_INICIO" }, 4);
    expect(rotacionActiva(conHover)).toBe(false);
    const sinHover = reducirCarrusel(conHover, { tipo: "INTERACCION_FIN" }, 4);
    expect(rotacionActiva(sinHover)).toBe(true);
  });

  it("INTERACCION_INICIO y FIN no tocan reproduciendo", () => {
    const base: EstadoCarrusel = { indice: 0, reproduciendo: false, pausadoTemporalmente: false };
    const conHover = reducirCarrusel(base, { tipo: "INTERACCION_INICIO" }, 4);
    expect(conHover.reproduciendo).toBe(false);
    expect(conHover.pausadoTemporalmente).toBe(true);
  });
});

describe("reducirCarrusel — secuencia de interacción táctil", () => {
  it("un swipe completo (INTERACCION_INICIO → SIGUIENTE → INTERACCION_FIN) navega sin alterar el estado persistente", () => {
    const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
    const alTocar = reducirCarrusel(base, { tipo: "INTERACCION_INICIO" }, 4);
    const trasSwipe = reducirCarrusel(alTocar, { tipo: "SIGUIENTE" }, 4);
    const alSoltar = reducirCarrusel(trasSwipe, { tipo: "INTERACCION_FIN" }, 4);
    expect(alSoltar).toEqual({ indice: 1, reproduciendo: true, pausadoTemporalmente: false });
  });

  it("un touchcancel (sin swipe) solo termina la pausa temporal, sin navegar ni tocar el estado persistente", () => {
    const base: EstadoCarrusel = { indice: 2, reproduciendo: false, pausadoTemporalmente: false };
    const alTocar = reducirCarrusel(base, { tipo: "INTERACCION_INICIO" }, 4);
    const alCancelar = reducirCarrusel(alTocar, { tipo: "INTERACCION_FIN" }, 4);
    expect(alCancelar).toEqual(base);
  });
});

describe("reducirCarrusel — acción desconocida", () => {
  it("devuelve el mismo estado sin romper", () => {
    const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
    // @ts-expect-error — acción inválida a propósito, para probar el default del switch
    expect(reducirCarrusel(base, { tipo: "NO_EXISTE" }, 4)).toEqual(base);
  });
});
