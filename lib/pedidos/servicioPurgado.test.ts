import { describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { ejecutarPurgado } from "./servicioPurgado";

type ResultadoSelect = { data: { id: string }[] | null; error: unknown };
type ResultadoConteo = { error: unknown; count: number | null };

function crearAdminFalso(opciones: {
  candidatos: ResultadoSelect;
  update?: ResultadoConteo;
  limite?: ResultadoConteo;
}) {
  const { candidatos, update, limite } = opciones;

  const selectCandidatos = vi.fn(async () => candidatos);
  const eqCandidatos = vi.fn(() => ({ lte: selectCandidatos }));
  const selectPedidos = vi.fn(() => ({ eq: eqCandidatos }));

  const selectUpdate = vi.fn(async () => update ?? { error: null, count: 0 });
  const inUpdate = vi.fn(() => ({ select: selectUpdate }));
  const updatePedidos = vi.fn(() => ({ in: inUpdate }));

  const pedidosBuilder = {
    select: selectPedidos,
    update: updatePedidos,
  };

  const selectDelete = vi.fn(async () => limite ?? { error: null, count: 0 });
  const ltDelete = vi.fn(() => ({ select: selectDelete }));
  const deleteLimite = vi.fn(() => ({ lt: ltDelete }));

  const limiteBuilder = {
    delete: deleteLimite,
  };

  const from = vi.fn((tabla: string) => {
    if (tabla === "pedidos") return pedidosBuilder;
    if (tabla === "limite_solicitudes") return limiteBuilder;
    throw new Error(`tabla inesperada: ${tabla}`);
  });

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: { from } as any,
    from,
    eqCandidatos,
    selectCandidatos,
    updatePedidos,
    inUpdate,
    selectUpdate,
    deleteLimite,
    ltDelete,
    selectDelete,
  };
}

describe("ejecutarPurgado", () => {
  it("devuelve error si falla el update de pedidos, nunca ok:true con purgados > 0 (Paso 2 del plan)", async () => {
    const { admin, deleteLimite } = crearAdminFalso({
      candidatos: { data: [{ id: "p1" }, { id: "p2" }], error: null },
      update: { error: { message: "boom" }, count: null },
    });
    createAdminClient.mockReturnValue(admin);

    const resultado = await ejecutarPurgado();

    expect(resultado).toEqual({
      ok: false,
      error: "No pudimos purgar los pedidos vencidos.",
    });
    // No revierte ni sigue de largo hacia el limitador tras un fallo de escritura.
    expect(deleteLimite).not.toHaveBeenCalled();
  });

  it("con cero candidatos, salta el update por completo y aun asi limpia el limitador", async () => {
    const { admin, updatePedidos, deleteLimite } = crearAdminFalso({
      candidatos: { data: [], error: null },
      limite: { error: null, count: 3 },
    });
    createAdminClient.mockReturnValue(admin);

    const resultado = await ejecutarPurgado();

    expect(updatePedidos).not.toHaveBeenCalled();
    expect(deleteLimite).toHaveBeenCalled();
    expect(resultado).toEqual({
      ok: true,
      pedidosPurgados: 0,
      contadoresLimpiados: 3,
    });
  });

  it("si el purgado de pedidos tiene exito pero falla la limpieza del limitador, reporta el fallo parcial exacto", async () => {
    const { admin } = crearAdminFalso({
      candidatos: { data: [{ id: "p1" }], error: null },
      update: { error: null, count: 1 },
      limite: { error: { message: "boom" }, count: null },
    });
    createAdminClient.mockReturnValue(admin);

    const resultado = await ejecutarPurgado();

    expect(resultado).toEqual({
      ok: false,
      error: "Pedidos purgados, pero falló la limpieza del limitador.",
    });
  });

  it("si falla el select inicial de candidatos, devuelve error sin llamar a update ni al limitador", async () => {
    const { admin, updatePedidos, deleteLimite } = crearAdminFalso({
      candidatos: { data: null, error: { message: "boom" } },
    });
    createAdminClient.mockReturnValue(admin);

    const resultado = await ejecutarPurgado();

    expect(resultado).toEqual({
      ok: false,
      error: "No pudimos consultar pedidos vencidos.",
    });
    expect(updatePedidos).not.toHaveBeenCalled();
    expect(deleteLimite).not.toHaveBeenCalled();
  });

  it("camino feliz: purga pedidos vencidos y limpia el limitador, devolviendo ambos conteos reales", async () => {
    const { admin } = crearAdminFalso({
      candidatos: { data: [{ id: "p1" }, { id: "p2" }], error: null },
      update: { error: null, count: 2 },
      limite: { error: null, count: 5 },
    });
    createAdminClient.mockReturnValue(admin);

    const resultado = await ejecutarPurgado();

    expect(resultado).toEqual({
      ok: true,
      pedidosPurgados: 2,
      contadoresLimpiados: 5,
    });
  });
});
