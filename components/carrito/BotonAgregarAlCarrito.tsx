"use client";

import { useRef } from "react";
import { MAX_ITEMS_CARRITO } from "@/lib/carrito/estado";
import { useCarrito } from "./CarritoProvider";
import ControlCantidad from "./ControlCantidad";

const botonClase = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-line px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600";

export default function BotonAgregarAlCarrito({
  vianderaId,
  platoId,
  nombre,
}: {
  vianderaId: string;
  platoId: string;
  nombre: string;
}) {
  const { carrito, hidratado, agregar, incrementar, decrementar, reemplazar } = useCarrito();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cantidad = carrito?.vianderaId === vianderaId
    ? carrito.items.find((item) => item.platoId === platoId)?.cantidad
    : undefined;
  const limiteAlcanzado = carrito?.vianderaId === vianderaId
    && cantidad === undefined
    && carrito.items.length >= MAX_ITEMS_CARRITO;

  function intentarAgregar() {
    const resultado = agregar(vianderaId, platoId);
    if (resultado.tipo === "requiere_reemplazo") dialogRef.current?.showModal();
  }

  if (!hidratado) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        aria-label={`Cargando pedido de ${nombre}`}
        className={`${botonClase} cursor-wait border-line bg-paper text-ink-muted opacity-70`}
      >
        Cargando…
      </button>
    );
  }

  return (
    <>
      {cantidad ? (
        <ControlCantidad
          nombre={nombre}
          cantidad={cantidad}
          onDecrementar={() => decrementar(platoId)}
          onIncrementar={() => incrementar(platoId)}
        />
      ) : (
        <button
          type="button"
          onClick={intentarAgregar}
          disabled={limiteAlcanzado}
          aria-label={limiteAlcanzado ? `Agregar ${nombre} al pedido (máximo de platos distintos alcanzado)` : `Agregar ${nombre} al pedido`}
          className={`${botonClase} border-coral-600 bg-coral-600 text-white hover:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Agregar
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`reemplazo-${platoId}`}
        onClick={(evento) => { if (evento.target === dialogRef.current) dialogRef.current.close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-line bg-card p-5 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <h2 id={`reemplazo-${platoId}`} className="font-display text-xl font-bold">Tu pedido actual es de otra cocina</h2>
        <p className="mt-2 text-sm text-ink-muted">Para pedir acá tenés que empezar un pedido nuevo.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={() => { reemplazar(vianderaId, platoId); dialogRef.current?.close(); }} className={`${botonClase} flex-1 border-coral-600 bg-coral-600 text-white`}>Empezar uno nuevo</button>
          <button type="button" onClick={() => dialogRef.current?.close()} className={`${botonClase} flex-1 text-ink`}>Conservar pedido</button>
        </div>
      </dialog>
    </>
  );
}
