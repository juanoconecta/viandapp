import { loadEnv } from "vite";

export function cargarEntornoIntegracion(
  cwd = process.cwd(),
  env: Record<string, string | undefined> = process.env,
) {
  Object.assign(env, loadEnv("integration", cwd, ""));
}
