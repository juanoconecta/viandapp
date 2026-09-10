export function normalizarContacto(valor: string | null): string | null {
  if (valor === null) return null;
  if (valor.includes("@")) return valor.trim().toLowerCase() || null;

  const digitos = valor.replace(/[^0-9]/g, "");
  if (/^549[0-9]{10}$/.test(digitos)) return digitos.slice(3);
  if (/^54[0-9]{10}$/.test(digitos)) return digitos.slice(2);
  return digitos || null;
}
