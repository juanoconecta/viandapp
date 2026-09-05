import { describe, expect, it } from "vitest";
import { crearClienteIntegracion } from "./clienteIntegracion";

const entornoValido: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  INTEGRATION_SUPABASE_URL: "https://viandapp-staging.supabase.co",
  INTEGRATION_SUPABASE_SERVICE_ROLE_KEY: "staging-service-role-key",
  INTEGRATION_ALLOW_REMOTE_DATABASE: "viandapp-staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://viandapp-production.supabase.co",
};

describe("crearClienteIntegracion", () => {
  it.each([
    [
      "falta la URL de integración",
      { ...entornoValido, INTEGRATION_SUPABASE_URL: undefined },
      "Faltan credenciales de integración.",
    ],
    [
      "falta la service role key de integración",
      { ...entornoValido, INTEGRATION_SUPABASE_SERVICE_ROLE_KEY: undefined },
      "Faltan credenciales de integración.",
    ],
    [
      "la URL de integración coincide con producción",
      {
        ...entornoValido,
        INTEGRATION_SUPABASE_URL: entornoValido.NEXT_PUBLIC_SUPABASE_URL,
      },
      "La base de integración no puede ser producción.",
    ],
    [
      "no se autorizó viandapp-staging",
      {
        ...entornoValido,
        INTEGRATION_ALLOW_REMOTE_DATABASE: "otro-proyecto",
      },
      "Staging remoto no autorizado para tests.",
    ],
  ])("rechaza cuando %s", (_motivo, env, mensaje) => {
    expect(() => crearClienteIntegracion(env)).toThrow(mensaje);
  });
});
