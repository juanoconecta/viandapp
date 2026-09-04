import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

import { obtenerAdhesionPropia } from "./adhesionPropia";

describe("obtenerAdhesionPropia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expone solo el estado, costo y nota permitidos para la viandera", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        estado: "aprobada",
        costo_envio_puni: 750,
        nota_admin: "Verificada",
      },
    });

    const resultado = await obtenerAdhesionPropia("viandera-1");

    expect(resultado).toEqual({
      estado: "aprobada",
      costoEnvioPuni: 750,
      notaAdmin: "Verificada",
    });
    expect(Object.keys(resultado ?? {}).sort()).toEqual([
      "costoEnvioPuni",
      "estado",
      "notaAdmin",
    ]);
    expect(select).toHaveBeenCalledWith("estado, costo_envio_puni, nota_admin");
  });

  it("devuelve null cuando no existe adhesion", async () => {
    maybeSingle.mockResolvedValue({ data: null });

    await expect(obtenerAdhesionPropia("viandera-1")).resolves.toBeNull();
  });
});
