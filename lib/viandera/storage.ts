const PREFIJO_PUBLICO = "/storage/v1/object/public/platos/";

export function pathDesdeFotoUrl(fotoUrl: string): string | null {
  const index = fotoUrl.indexOf(PREFIJO_PUBLICO);
  if (index === -1) return null;
  return fotoUrl.slice(index + PREFIJO_PUBLICO.length);
}

export function fotoUrlDesdePath(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}${PREFIJO_PUBLICO}${path}`;
}
