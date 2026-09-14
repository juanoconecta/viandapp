import type { ModalidadPedido } from "@/types";

export type ItemMensajePedido = {
  nombre: string;
  precioCapturado: number;
  cantidad: number;
};

export type DatosMensajePedido = {
  vianderaNombre: string;
  nombreComprador: string;
  modalidad: ModalidadPedido;
  direccionEnvio: string | null;
  costoEnvio: number;
  total: number;
  items: ItemMensajePedido[];
};

function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(valor);
}

function esDineroValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0;
}

function nombreModalidad(modalidad: ModalidadPedido): string {
  switch (modalidad) {
    case "retiro":
      return "Retiro en la cocina";
    case "envio_propio":
      return "Envío de la cocina";
    case "envio_puni":
      return "Envío con Puni";
  }
}

export function construirMensajePedido(datos: DatosMensajePedido): string {
  const vianderaNombre = datos.vianderaNombre.trim();
  const nombreComprador = datos.nombreComprador.trim();
  const direccion = datos.direccionEnvio?.trim() ?? null;

  if (!vianderaNombre || !nombreComprador || datos.items.length === 0) {
    throw new Error("Datos obligatorios ausentes");
  }
  if (!esDineroValido(datos.costoEnvio) || !esDineroValido(datos.total)) {
    throw new Error("Importe inválido");
  }
  if (datos.modalidad !== "retiro" && !direccion) {
    throw new Error("La dirección es obligatoria para envíos");
  }

  const lineasItems = datos.items.map((item) => {
    if (!esDineroValido(item.precioCapturado) || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new Error("Ítem inválido");
    }
    const subtotal = item.precioCapturado * item.cantidad;
    if (!esDineroValido(subtotal)) throw new Error("Subtotal inválido");
    return `• ${item.cantidad} x ${item.nombre} — ${formatearMoneda(subtotal)}`;
  });

  const lineas = [
    `Hola ${vianderaNombre}, soy ${nombreComprador}. Quiero hacer este pedido:`,
    "",
    ...lineasItems,
    "",
    `Modalidad: ${nombreModalidad(datos.modalidad)}`,
  ];
  if (datos.modalidad !== "retiro") lineas.push(`Dirección: ${direccion}`);
  lineas.push(`Envío: ${formatearMoneda(datos.costoEnvio)}`);
  lineas.push(`Total: ${formatearMoneda(datos.total)}`, "", "Pedido generado desde viandapp.ar.");
  return lineas.join("\n");
}
