import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export function validarEntornoIntegracion(env = process.env) {
  const url = env.INTEGRATION_SUPABASE_URL;
  const key = env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Faltan credenciales de integración.");
  if (url === env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("La base de integración no puede ser producción.");
  }
  if (env.INTEGRATION_ALLOW_REMOTE_DATABASE !== "viandapp-staging") {
    throw new Error("Staging remoto no autorizado para tests.");
  }
  return { url, key };
}

export function crearClienteIntegracion(env = process.env) {
  const { url, key } = validarEntornoIntegracion(env);
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
