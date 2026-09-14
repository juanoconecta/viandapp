import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  maybeSingle,
  single,
  from,
  update,
  updateEqId,
  updateEqVianderaId,
  createAdminClient,
  obtenerAdhesionPropia,
  revalidatePath,
  redirect,
} = vi.hoisted(() => {
  const getUser = vi.fn();
  const maybeSingle = vi.fn();
  const single = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle, single }));
  const select = vi.fn(() => ({ eq }));
  const updateEqVianderaId = vi.fn(() => Promise.resolve({ error: null }));
  const updateEqId = vi.fn(() => ({ eq: updateEqVianderaId }));
  const update = vi.fn(() => ({ eq: updateEqId }));
  const from = vi.fn(() => ({ select, update }));
  return {
    getUser,
    maybeSingle,
    single,
    eq,
    select,
    from,
    update,
    updateEqId,
    updateEqVianderaId,
    createAdminClient: vi.fn(),
    obtenerAdhesionPropia: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/envios/adhesionPropia", () => ({ obtenerAdhesionPropia }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

import {
  actualizarCostoEnvioPuni,
  actualizarEstadoPedido,
  solicitarAdhesionPuni,
} from "./actions";

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

describe("actualizarEstadoPedido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no llama a supabase.from si la transicion es invalida", async () => {
    const formData = new FormData();
    formData.set("pedidoId", "pedido-1");
    formData.set("estadoActual", "confirmado");
    formData.set("nuevoEstado", "generado");

    await actualizarEstadoPedido(formData);

    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("actualiza el estado filtrando por pedido y por la viandera propia en una transicion valida", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    maybeSingle.mockResolvedValue({ data: { id: "viandera-1" } });

    const formData = new FormData();
    formData.set("pedidoId", "pedido-1");
    formData.set("estadoActual", "generado");
    formData.set("nuevoEstado", "confirmado");

    await actualizarEstadoPedido(formData);

    expect(from).toHaveBeenCalledWith("pedidos");
    expect(update).toHaveBeenCalledWith({ estado: "confirmado" });
    expect(updateEqId).toHaveBeenCalledWith("id", "pedido-1");
    expect(updateEqVianderaId).toHaveBeenCalledWith("vianderas_id", "viandera-1");
    expect(revalidatePath).toHaveBeenCalledWith("/viandera/pedidos");
  });

  it("redirige a /app sin actualizar si no hay viandera autenticada", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const formData = new FormData();
    formData.set("pedidoId", "pedido-1");
    formData.set("estadoActual", "generado");
    formData.set("nuevoEstado", "confirmado");

    await expect(actualizarEstadoPedido(formData)).rejects.toThrow("REDIRECT:/app");

    expect(redirect).toHaveBeenCalledWith("/app");
    expect(update).not.toHaveBeenCalled();
  });
});
