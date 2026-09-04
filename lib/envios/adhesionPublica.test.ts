import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, select, eq, inFilter } = vi.hoisted(() => {
  const inFilter = vi.fn();
  const eq = vi.fn(() => ({ in: inFilter }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, inFilter };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

import { adhesionesAprobadas } from "./adhesionPublica";

describe("adhesionesAprobadas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no consulta la base cuando no recibe vianderas", async () => {
    await expect(adhesionesAprobadas([])).resolves.toEqual(new Map());
    expect(from).not.toHaveBeenCalled();
  });

  it("expone solo viandera y costo de adhesiones aprobadas", async () => {
    inFilter.mockResolvedValue({
      data: [{ viandera_id: "v1", costo_envio_puni: 800 }],
      error: null,
    });

    const resultado = await adhesionesAprobadas(["v1"]);

    expect(resultado.get("v1")).toEqual({ viandera_id: "v1", costo_envio_puni: 800 });
    expect(Object.keys(resultado.get("v1") ?? {}).sort()).toEqual([
      "costo_envio_puni",
      "viandera_id",
    ]);
    expect(select).toHaveBeenCalledWith("viandera_id, costo_envio_puni");
    expect(eq).toHaveBeenCalledWith("estado", "aprobada");
  });
});
