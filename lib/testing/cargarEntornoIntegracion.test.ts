import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cargarEntornoIntegracion } from "./cargarEntornoIntegracion";

const directoriosTemporales: string[] = [];

afterEach(async () => {
  await Promise.all(
    directoriosTemporales.splice(0).map((directorio) =>
      rm(directorio, { recursive: true, force: true }),
    ),
  );
});

describe("cargarEntornoIntegracion", () => {
  it("carga secretos desde .env.integration.local usando el modo integration", async () => {
    const directorio = await mkdtemp(join(tmpdir(), "viandapp-integration-"));
    directoriosTemporales.push(directorio);
    await writeFile(
      join(directorio, ".env.integration.local"),
      "INTEGRATION_SUPABASE_URL=https://viandapp-staging.example.invalid\nINTEGRATION_SUPABASE_SERVICE_ROLE_KEY=staging-key\n",
    );
    const env: Record<string, string> = {};

    cargarEntornoIntegracion(directorio, env);

    expect(env).toMatchObject({
      INTEGRATION_SUPABASE_URL: "https://viandapp-staging.example.invalid",
      INTEGRATION_SUPABASE_SERVICE_ROLE_KEY: "staging-key",
    });
  });
});
