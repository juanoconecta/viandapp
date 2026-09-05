"use client";

import { useState, type FormEvent } from "react";
import { generarPedido, type ResultadoGenerarPedido } from "@/app/pedido/actions";
import { calcularTotal } from "@/lib/pedidos/total";
import { CLAVE_CARRITO, mismoContenidoCarrito, parsearCarrito } from "@/lib/carrito/estado";
import { invalidarClaveCheckout, obtenerClaveCheckout } from "@/lib/carrito/sesionCheckout";
import type { ItemCheckout, ModalidadCheckout } from "@/lib/carrito/checkoutServidor";
import type { ModalidadPedido } from "@/types";
import RevisarCambios from "./RevisarCambios";

type Props = {
  viandera: { id: string; nombre: string; slug: string };
  items: ItemCheckout[];
  modalidades: ModalidadCheckout[];
};

export default function ConfirmarPedido({ viandera, items, modalidades }: Props) {
  const [modalidad, setModalidad] = useState<ModalidadPedido>(modalidades[0]?.id ?? "retiro");
  const [pendiente, setPendiente] = useState(false);
  const [resultado, setResultado] = useState<ResultadoGenerarPedido | null>(null);
  const opcion = modalidades.find((actual) => actual.id === modalidad);
  const total = calcularTotal(items.map((item) => ({ precioCapturado: item.precio, cantidad: item.cantidad })), opcion?.costo ?? 0);
  const carrito = { vianderaId: viandera.id, items: items.map((item) => ({ platoId: item.platoId, cantidad: item.cantidad })) };

  if (modalidades.length === 0) {
    return <RevisarCambios slug={viandera.slug} cambios={[{ tipo: "modalidad_no_disponible", modalidad: null }]} />;
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!opcion || pendiente) return;
    setPendiente(true);
    setResultado(null);
    const formulario = new FormData(evento.currentTarget);
    const idempotencyKey = obtenerClaveCheckout(carrito, window.sessionStorage, () => crypto.randomUUID());
    const respuesta = await generarPedido({
      idempotencyKey,
      items: items.map((item) => ({
        viandaId: item.platoId,
        vianderaId: item.vianderaId,
        nombreVisto: item.nombre,
        precioVisto: item.precio,
        cantidad: item.cantidad,
      })),
      modalidad,
      costoEnvioEsperado: opcion.costo,
      nombreComprador: String(formulario.get("nombre") ?? ""),
      telefonoComprador: String(formulario.get("telefono") ?? ""),
      direccionEnvio: modalidad === "retiro" ? null : String(formulario.get("direccion") ?? ""),
      aceptaMarketing: formulario.get("aceptaMarketing") === "on",
    });

    if (respuesta.status === "ok") {
      const guardado = parsearCarrito(window.localStorage.getItem(CLAVE_CARRITO));
      if (mismoContenidoCarrito(guardado, carrito)) window.localStorage.removeItem(CLAVE_CARRITO);
      window.location.assign(respuesta.whatsappHref);
      return;
    }
    if (respuesta.status === "revisar_carrito") invalidarClaveCheckout(window.sessionStorage);
    setResultado(respuesta);
    setPendiente(false);
  }

  const nombresPorId = Object.fromEntries(items.map((item) => [item.platoId, item.nombre]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-teal">Tu pedido en {viandera.nombre}</p>
        <h1 className="font-display text-3xl font-bold text-ink">Confirmá tu pedido</h1>
        <p className="mt-1 text-sm text-ink-muted">Revisá los datos antes de continuar la conversación por WhatsApp.</p>
      </header>

      {resultado?.status === "revisar_carrito" && <div className="mb-6"><RevisarCambios slug={viandera.slug} cambios={resultado.cambios} nombresPorId={nombresPorId} /></div>}
      {(resultado?.status === "error" || resultado?.status === "limite_excedido") && <p role="status" aria-live="polite" className="mb-5 rounded-2xl bg-soft-coral p-4 text-sm text-ink">{resultado.mensaje}</p>}

      <form onSubmit={enviar} className="overflow-hidden rounded-3xl border border-line bg-card md:grid md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5 p-5 sm:p-7">
          <div><label htmlFor="nombre" className="block text-sm font-medium">Tu nombre</label><input id="nombre" name="nombre" required autoComplete="name" className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal" /></div>
          <div><label htmlFor="telefono" className="block text-sm font-medium">Tu teléfono</label><input id="telefono" name="telefono" type="tel" required autoComplete="tel" className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal" /></div>
          <fieldset><legend className="text-sm font-medium">¿Cómo lo recibís?</legend><div className="mt-2 space-y-2">{modalidades.map((actual) => <label key={actual.id} className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-xl border border-line px-3"><span><input type="radio" name="modalidad" value={actual.id} checked={modalidad === actual.id} onChange={() => setModalidad(actual.id)} className="mr-2 accent-teal" />{actual.etiqueta}</span><span className="text-sm text-ink-muted">{actual.costo === 0 ? "Sin costo" : `$${actual.costo.toLocaleString("es-AR")}`}</span></label>)}</div></fieldset>
          {modalidad !== "retiro" && <div><label htmlFor="direccion" className="block text-sm font-medium">Dirección de entrega</label><input id="direccion" name="direccion" required autoComplete="street-address" className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal" /></div>}
          <label className="flex min-h-[44px] items-start gap-2 text-sm text-ink-muted"><input type="checkbox" name="aceptaMarketing" className="mt-1 accent-teal" />Quiero recibir novedades y promociones de ViandApp.</label>
        </div>

        <aside className="border-t border-line bg-paper/60 p-5 md:border-l md:border-t-0 md:p-6">
          <h2 className="font-display text-xl font-bold">Tu libreta</h2>
          <ul className="mt-3 divide-y divide-line">{items.map((item) => <li key={item.platoId} className="flex justify-between gap-3 py-3 text-sm"><span>{item.cantidad} × {item.nombre}</span><span className="whitespace-nowrap">${(item.precio * item.cantidad).toLocaleString("es-AR")}</span></li>)}</ul>
          {opcion && opcion.costo > 0 && <p className="flex justify-between border-t border-line py-3 text-sm"><span>Envío estimado</span><span>${opcion.costo.toLocaleString("es-AR")}</span></p>}
          <p className="mt-3 text-sm text-ink-muted">Total estimado</p>
          <p className="font-display text-3xl font-bold text-ink">${total.toLocaleString("es-AR")}</p>
          <p className="mt-1 text-xs text-ink-muted">La cocina confirma disponibilidad y coordinación final por WhatsApp.</p>
          <button type="submit" disabled={pendiente} className="mt-5 min-h-[44px] w-full rounded-full bg-coral-600 px-5 text-sm font-semibold text-white hover:bg-coral-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600">Continuar por WhatsApp</button>
        </aside>
      </form>
    </div>
  );
}
