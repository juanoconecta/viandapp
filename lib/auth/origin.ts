import { headers } from "next/headers";

// Usamos x-forwarded-host antes que host: en Vercel, los preview deployments
// pueden resolver "host" a un dominio interno distinto del dominio público
// por el que entró la usuaria, y el callback de OAuth tiene que volver a ese
// dominio público. Fallback a localhost si no hay ningún header (no debería
// pasar en Vercel, pero evita construir un origin con "null").
export async function resolverOrigin() {
  const headersList = await headers();
  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
