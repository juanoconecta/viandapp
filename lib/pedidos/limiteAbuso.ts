export function debeLimitar(intentosDespuesDeIncrementar: number, limite: number): boolean {
  return intentosDespuesDeIncrementar > limite;
}

export function ventanaActual(ahora: Date, minutosVentana: number): Date {
  const ms = minutosVentana * 60 * 1000;
  return new Date(Math.floor(ahora.getTime() / ms) * ms);
}
