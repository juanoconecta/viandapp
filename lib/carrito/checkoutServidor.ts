import { costoEnvioVigente, modalidadesDisponibles } from "@/lib/envios/modalidades";
import type { EstadoAdhesionPuni, ModalidadPedido } from "@/types";
import type { CarritoAlmacenado } from "./estado";

type VianderaCheckout = {
  id: string;
  nombre: string;
  slug: string;
  ofrece_retiro: boolean;
  ofrece_envio: boolean;
  costo_envio_propio: number | null;
};

type PlatoActual = {
  id: string;
  vianderas_id: string;
  nombre: string;
  precio: number | null;
  disponible: boolean;
};

type AdhesionCheckout = { estado: EstadoAdhesionPuni; costo_envio_puni: number | null } | null;

export type ModalidadCheckout = { id: ModalidadPedido; etiqueta: string; costo: number };
export type ItemCheckout = {
  platoId: string;
  vianderaId: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type CheckoutPreparado =
  | { estado: "revisar"; slug: string; platosNoDisponibles: string[] }
  | {
      estado: "listo";
      viandera: { id: string; nombre: string; slug: string };
      items: ItemCheckout[];
      modalidades: ModalidadCheckout[];
    };

const ETIQUETAS: Record<ModalidadPedido, string> = {
  retiro: "Retiro",
  envio_propio: "Envío de la cocina",
  envio_puni: "Envío con Puni",
};

export function prepararCheckout(
  carrito: CarritoAlmacenado,
  viandera: VianderaCheckout,
  platos: PlatoActual[],
  adhesion: AdhesionCheckout,
): CheckoutPreparado {
  const porId = new Map(platos.map((plato) => [plato.id, plato]));
  const platosNoDisponibles = carrito.items
    .filter((item) => {
      const plato = porId.get(item.platoId);
      return !plato || plato.vianderas_id !== carrito.vianderaId || !plato.disponible || typeof plato.precio !== "number" || !Number.isFinite(plato.precio) || plato.precio < 0;
    })
    .map((item) => item.platoId);

  if (viandera.id !== carrito.vianderaId || platosNoDisponibles.length > 0) {
    return {
      estado: "revisar",
      slug: viandera.slug,
      platosNoDisponibles: viandera.id === carrito.vianderaId
        ? platosNoDisponibles
        : carrito.items.map((item) => item.platoId),
    };
  }

  const items = carrito.items.map((item) => {
    const plato = porId.get(item.platoId)!;
    return {
      platoId: plato.id,
      vianderaId: viandera.id,
      nombre: plato.nombre,
      precio: plato.precio as number,
      cantidad: item.cantidad,
    };
  });
  const modalidades = modalidadesDisponibles(viandera, adhesion).flatMap((id) => {
    const costo = costoEnvioVigente(id, viandera, adhesion);
    return typeof costo === "number" && Number.isFinite(costo) && costo >= 0
      ? [{ id, etiqueta: ETIQUETAS[id], costo }]
      : [];
  });

  return {
    estado: "listo",
    viandera: { id: viandera.id, nombre: viandera.nombre, slug: viandera.slug },
    items,
    modalidades,
  };
}
