import { afterEach, describe, expect, it, vi } from "vitest";

const { ejecutarPurgado } = vi.hoisted(() => ({
  ejecutarPurgado: vi.fn(),
}));

vi.mock("@/lib/pedidos/servicioPurgado", () => ({ ejecutarPurgado }));

import { GET } from "./route";

function crearRequest(authorization?: string) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request("http://test/", { headers });
}

describe("GET /api/cron/purgar-pedidos", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("falla cerrado (401) si CRON_SECRET no está configurado, sin llamar a ejecutarPurgado", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const respuesta = await GET(crearRequest("Bearer undefined"));

    expect(respuesta.status).toBe(401);
    expect(ejecutarPurgado).not.toHaveBeenCalled();
  });

  it("falla cerrado (401) si CRON_SECRET no está configurado, incluso con un header 'Bearer '", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const respuesta = await GET(crearRequest("Bearer "));

    expect(respuesta.status).toBe(401);
    expect(ejecutarPurgado).not.toHaveBeenCalled();
  });

  it("devuelve 401 si CRON_SECRET está configurado pero el header no coincide", async () => {
    vi.stubEnv("CRON_SECRET", "el-secreto-real");

    const respuesta = await GET(crearRequest("Bearer otro-valor"));

    expect(respuesta.status).toBe(401);
    expect(ejecutarPurgado).not.toHaveBeenCalled();
  });

  it("llama a ejecutarPurgado y devuelve 200 con los conteos cuando el header coincide", async () => {
    vi.stubEnv("CRON_SECRET", "el-secreto-real");
    ejecutarPurgado.mockResolvedValue({
      ok: true,
      pedidosPurgados: 4,
      contadoresLimpiados: 9,
    });

    const respuesta = await GET(crearRequest("Bearer el-secreto-real"));
    const cuerpo = await respuesta.json();

    expect(ejecutarPurgado).toHaveBeenCalledTimes(1);
    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({ purgados: 4, limitadorLimpiado: 9 });
  });

  it("devuelve 500 con el mensaje de error cuando ejecutarPurgado falla", async () => {
    vi.stubEnv("CRON_SECRET", "el-secreto-real");
    ejecutarPurgado.mockResolvedValue({
      ok: false,
      error: "No pudimos consultar pedidos vencidos.",
    });

    const respuesta = await GET(crearRequest("Bearer el-secreto-real"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({ error: "No pudimos consultar pedidos vencidos." });
  });
});
