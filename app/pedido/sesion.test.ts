import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCookieStore, randomUUID } = vi.hoisted(() => ({
  getCookieStore: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: getCookieStore }));
vi.mock("node:crypto", () => ({ randomUUID }));

import { asegurarSesionPedido } from "./sesion";

describe("asegurarSesionPedido", () => {
  const set = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    getCookieStore.mockResolvedValue({ get: vi.fn(), set });
    randomUUID.mockReturnValue("123e4567-e89b-12d3-a456-426614174000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a valid existing UUID without writing a cookie", async () => {
    const get = vi.fn().mockReturnValue({
      value: "123e4567-e89b-12d3-a456-426614174000",
    });
    getCookieStore.mockResolvedValue({ get, set });

    await expect(asegurarSesionPedido()).resolves.toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("sets an absent session with exact development options", async () => {
    await expect(asegurarSesionPedido()).resolves.toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(set).toHaveBeenCalledWith(
      "viandapp_sesion",
      "123e4567-e89b-12d3-a456-426614174000",
      { httpOnly: true, secure: false, sameSite: "lax", path: "/" },
    );
  });

  it("rotates a malformed session value", async () => {
    const get = vi.fn().mockReturnValue({ value: "not-a-uuid" });
    getCookieStore.mockResolvedValue({ get, set });

    await expect(asegurarSesionPedido()).resolves.toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(set).toHaveBeenCalled();
  });

  it("sets secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await asegurarSesionPedido();

    expect(set).toHaveBeenCalledWith(
      "viandapp_sesion",
      "123e4567-e89b-12d3-a456-426614174000",
      { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    );
  });
});
