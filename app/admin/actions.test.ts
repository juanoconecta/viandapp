import { describe, expect, it, vi } from "vitest";

const { getUser, createAdminClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/auth/admin", () => ({
  esAdmin: (email?: string | null) => email === "admin@viandapp.test",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { resolverAdhesionPuni } from "./actions";

describe("resolverAdhesionPuni", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "otra@persona.test" } } });

    const resultado = await resolverAdhesionPuni({ status: "idle" }, new FormData());

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
