// Solo permite rutas internas para evitar open redirects. No alcanza con
// chequear prefijos: "//evil.com" es protocol-relative, "@evil.com" se
// interpreta como userinfo@host en una URL absoluta, y "/\evil.com" pasa
// cualquier chequeo de prefijo con "/" pero el navegador lo resuelve como
// "//evil.com" (WHATWG URL trata "\" como "/" para esquemas especiales).
// En vez de seguir enumerando patrones prohibidos, parseamos la URL contra
// un origin fijo y solo aceptamos el resultado si ese origin no cambió.
export function sanitizarRedirect(valor: string | undefined | null): string {
  if (!valor) return "/app";
  try {
    const url = new URL(valor, "http://viandapp.invalid");
    if (url.origin !== "http://viandapp.invalid") return "/app";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/app";
  }
}
