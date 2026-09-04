import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  single,
  from,
  createAdminClient,
  obtenerAdhesionPropia,
} = vi.hoisted(() => {
  const getUser = vi.fn();
  const maybeSingle = vi.fn();
  const single = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle, single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    getUser,
    maybeSingle,
    single,
    eq,
    select,
    from,
    createAdminClient: vi.fn(),
    obtenerAdhesionPropia: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/envios/adhesionPropia", () => ({ obtenerAdhesionPropia }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { actualizarCostoEnvioPuni, solicitarAdhesionPuni } from "./actions";

describe("acciones de adhesion Puni de la viandera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza una solicitud sin autenticar antes de crear el cliente admin", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const resultado = await solicitarAdhesionPuni(
      { status: "idle" },
      new FormData(),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autenticado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("no permite actualizar el costo si la adhesion no esta aprobada", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    single.mockResolvedValue({ data: { id: "viandera-1" } });
    obtenerAdhesionPropia.mockResolvedValue({
      estado: "pendiente",
      costoEnvioPuni: null,
      notaAdmin: null,
    });

    const formData = new FormData();
    formData.set("costoEnvioPuni", "900");
    const resultado = await actualizarCostoEnvioPuni({ status: "idle" }, formData);

    expect(resultado).toEqual({
      status: "error",
      mensaje: "Tu adhesión todavía no está aprobada.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza volver a solicitar desde aprobada sin escribir", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    single.mockResolvedValue({ data: { id: "viandera-1" } });
    obtenerAdhesionPropia.mockResolvedValue({
      estado: "aprobada",
      costoEnvioPuni: 900,
      notaAdmin: null,
    });

    const resultado = await solicitarAdhesionPuni(
      { status: "idle" },
      new FormData(),
    );

    expect(resultado).toEqual({
      status: "error",
      mensaje: "No podés volver a solicitar desde el estado actual.",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
