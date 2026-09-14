export type ItemParaTotal = { precioCapturado: number; cantidad: number };

function numeroValido(valor: number, permitirCero: boolean): boolean {
  if (!Number.isFinite(valor)) return false;
  return permitirCero ? valor >= 0 : valor > 0;
}

export function calcularTotal(items: ItemParaTotal[], costoEnvio: number): number {
  if (items.length === 0) {
    throw new Error("No se puede calcular el total de un carrito vacío.");
  }
  if (!numeroValido(costoEnvio, true)) {
    throw new Error("Costo de envío inválido.");
  }
  for (const item of items) {
    if (!numeroValido(item.precioCapturado, true)) {
      throw new Error("Precio inválido.");
    }
    if (!numeroValido(item.cantidad, false) || !Number.isInteger(item.cantidad)) {
      throw new Error("Cantidad inválida.");
    }
  }
  const subtotalItems = items.reduce(
    (acc, item) => acc + item.precioCapturado * item.cantidad,
    0,
  );
  return subtotalItems + costoEnvio;
}

export function validarUnaSolaCocina(items: { vianderaId: string }[]): boolean {
  const distintas = new Set(items.map((i) => i.vianderaId));
  return distintas.size <= 1;
}
