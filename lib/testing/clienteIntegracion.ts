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

// Reutiliza las mismas guardas de seguridad (no producción, staging
// autorizado) sin usar la service_role key que devuelve validarEntornoIntegracion.
export function crearClienteAnonimo(env = process.env) {
  validarEntornoIntegracion(env);
  const anonKey = env.INTEGRATION_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Falta INTEGRATION_SUPABASE_ANON_KEY.");
  return createClient<Database>(env.INTEGRATION_SUPABASE_URL!, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Manera estándar de ejercer el rol `authenticated` de Postgres contra RLS
// en un proyecto Supabase: firma sesión con un usuario real (descartable) y
// adjunta su access token como header Authorization en un cliente construido
// con la anon key. `auth.uid()` en Postgres resuelve al id de ese usuario
// sintético. Siempre llamar `limpiar()` en un finally/afterEach para no dejar
// usuarios de auth sintéticos en viandapp-staging.
export async function crearClienteAutenticadoSintetico(env = process.env) {
  validarEntornoIntegracion(env);
  const anonKey = env.INTEGRATION_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Falta INTEGRATION_SUPABASE_ANON_KEY.");

  const admin = crearClienteIntegracion(env);
  const email = `crm-test-${crypto.randomUUID()}@viandapp-staging.invalid`;
  const password = crypto.randomUUID();

  const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errorCrear || !creado.user) throw new Error("No se pudo crear usuario sintético de prueba.");

  const anonimo = createClient<Database>(env.INTEGRATION_SUPABASE_URL!, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sesion, error: errorLogin } = await anonimo.auth.signInWithPassword({
    email,
    password,
  });
  if (errorLogin || !sesion.session) throw new Error("No se pudo iniciar sesión con el usuario sintético.");

  const autenticado = createClient<Database>(env.INTEGRATION_SUPABASE_URL!, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${sesion.session.access_token}` } },
  });

  return {
    client: autenticado,
    userId: creado.user.id,
    limpiar: async () => {
      await admin.auth.admin.deleteUser(creado.user.id);
    },
  };
}
