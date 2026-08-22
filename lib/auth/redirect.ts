// Solo permite rutas internas (un único "/" inicial) para evitar open
// redirects (ej. "//evil.com" es protocol-relative, y "@evil.com" se
// interpreta como userinfo@host en una URL absoluta — ambos deben
// rechazarse, no solo los que empiezan con "http").
export function sanitizarRedirect(valor: string | undefined | null): string {
  if (valor && valor.startsWith("/") && !valor.startsWith("//")) {
    return valor;
  }
  return "/app";
}
