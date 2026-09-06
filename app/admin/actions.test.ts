import { describe, expect, it, vi } from "vitest";

const { getUser, createAdminClient, ejecutarPurgado } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createAdminClient: vi.fn(),
  ejecutarPurgado: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/auth/admin", () => ({
  esAdmin: (email?: string | null) => email === "admin@viandapp.test",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/pedidos/servicioPurgado", () => ({ ejecutarPurgado }));

import { purgarPedidosVencidos, resolverAdhesionPuni } from "./actions";

describe("resolverAdhesionPuni", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "otra@persona.test" } } });

    const resultado = await resolverAdhesionPuni({ status: "idle" }, new FormData());

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("purgarPedidosVencidos", () => {
  it("rechaza usuarios no-admin antes de llamar a ejecutarPurgado", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "otra@persona.test" } } });

    const resultado = await purgarPedidosVencidos({ status: "idle" }, new FormData());

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(ejecutarPurgado).not.toHaveBeenCalled();
  });

  it("surge el mensaje de error exacto cuando ejecutarPurgado falla", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "admin@viandapp.test" } } });
    ejecutarPurgado.mockResolvedValue({
      ok: false,
      error: "Pedidos purgados, pero falló la limpieza del limitador.",
    });

    const resultado = await purgarPedidosVencidos({ status: "idle" }, new FormData());

    expect(resultado).toEqual({
      status: "error",
      mensaje: "Pedidos purgados, pero falló la limpieza del limitador.",
    });
  });

  it("devuelve status ok con ambos conteos cuando el purgado tiene exito", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "admin@viandapp.test" } } });
    ejecutarPurgado.mockResolvedValue({
      ok: true,
      pedidosPurgados: 4,
      contadoresLimpiados: 9,
    });

    const resultado = await purgarPedidosVencidos({ status: "idle" }, new FormData());

    expect(resultado.status).toBe("ok");
    if (resultado.status === "ok") {
      expect(resultado.mensaje).toContain("4");
      expect(resultado.mensaje).toContain("9");
    }
  });
});
