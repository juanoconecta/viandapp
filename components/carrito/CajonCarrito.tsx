"use client";

import { useEffect, useRef, useState } from "react";
import { construirUrlCheckout } from "@/lib/carrito/checkout";
import type { CarritoAlmacenado } from "@/lib/carrito/estado";
import StickyContactBar from "@/components/storefront/StickyContactBar";
import { useCarrito } from "./CarritoProvider";

export type PlatoVisibleCarrito = { id: string; nombre: string; precio: number | null };

const foco = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600";

export function CajonCarritoVista({
  nombreViandera,
  carrito,
  platos,
  abierto,
  onAbrir,
  onCerrar,
  onIncrementar,
  onDecrementar,
  onVaciar,
  dialogRef,
}: {
  nombreViandera: string;
  carrito: CarritoAlmacenado;
  platos: PlatoVisibleCarrito[];
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  onIncrementar: (platoId: string) => void;
  onDecrementar: (platoId: string) => void;
  onVaciar: () => void;
  dialogRef?: React.RefObject<HTMLDialogElement | null>;
}) {
  const porId = new Map(carrito.items.map((item) => [item.platoId, item]));
  const filas = platos.flatMap((plato) => {
    const item = porId.get(plato.id);
    return item ? [{ ...plato, cantidad: item.cantidad }] : [];
  });
  const cantidad = carrito.items.reduce((total, item) => total + item.cantidad, 0);
  const subtotal = filas.reduce((total, fila) => total + (fila.precio ?? 0) * fila.cantidad, 0);
  const hayPrecioPendiente = filas.some((fila) => fila.precio === null);

  return (
    <>
      <StickyContactBar>
        <div className="flex min-h-[44px] items-center justify-between gap-4">
          <p className="font-display font-bold text-ink">Tu pedido · {cantidad} {cantidad === 1 ? "plato" : "platos"}</p>
          <button type="button" onClick={onAbrir} className={`min-h-[44px] rounded-full bg-coral-600 px-5 text-sm font-semibold text-white hover:bg-coral-700 ${foco}`}>Ver pedido</button>
        </div>
      </StickyContactBar>

      <dialog
        ref={dialogRef}
        open={abierto || undefined}
        aria-labelledby="titulo-cajon-carrito"
        onClose={onCerrar}
        onClick={(evento) => { if (evento.target === dialogRef?.current) onCerrar(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="p-5">
          <h2 id="titulo-cajon-carrito" className="font-display text-xl font-bold">Tu pedido en {nombreViandera}</h2>
          <ul className="mt-4 divide-y divide-line">
            {filas.map((fila) => (
              <li key={fila.id} className="flex items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{fila.nombre}</p><p className="text-xs text-ink-muted">{fila.precio === null ? "Precio a revisar" : `Subtotal actual estimado: $${(fila.precio * fila.cantidad).toLocaleString("es-AR")}`}</p></div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onDecrementar(fila.id)} aria-label={`Quitar una ${fila.nombre}`} className={`min-h-[44px] min-w-[44px] rounded-full border border-teal text-teal ${foco}`}>−</button>
                  <output className="min-w-6 text-center font-display font-bold">{fila.cantidad}</output>
                  <button type="button" onClick={() => onIncrementar(fila.id)} aria-label={`Agregar una ${fila.nombre}`} className={`min-h-[44px] min-w-[44px] rounded-full border border-teal text-teal ${foco}`}>+</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right text-sm text-ink-muted">{hayPrecioPendiente ? "Subtotal conocido" : "Subtotal actual estimado"}</p>
          <p className="text-right font-display text-2xl font-bold">{hayPrecioPendiente && subtotal === 0 ? "Necesita revisión" : `$${subtotal.toLocaleString("es-AR")}`}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={onCerrar} className={`min-h-[44px] rounded-full border border-line px-4 text-sm font-semibold ${foco}`}>Seguir eligiendo</button>
            <a href={construirUrlCheckout(carrito)} className={`flex min-h-[44px] items-center justify-center rounded-full bg-coral-600 px-4 text-sm font-semibold text-white ${foco}`}>Continuar</a>
          </div>
          <button type="button" onClick={onVaciar} className={`mt-4 min-h-[44px] text-sm font-medium text-ink-muted underline ${foco}`}>Vaciar pedido</button>
        </div>
      </dialog>
    </>
  );
}

export default function CajonCarrito({ vianderaId, nombreViandera, platos }: { vianderaId: string; nombreViandera: string; platos: PlatoVisibleCarrito[] }) {
  const { carrito, hidratado, incrementar, decrementar, vaciar } = useCarrito();
  const [abierto, setAbierto] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmacionRef = useRef<HTMLDialogElement>(null);
  const propio = hidratado && carrito?.vianderaId === vianderaId && carrito.items.length > 0 ? carrito : null;

  useEffect(() => {
    if (!dialogRef.current) return;
    if (abierto && !dialogRef.current.open) dialogRef.current.showModal();
    if (!abierto && dialogRef.current.open) dialogRef.current.close();
  }, [abierto]);

  if (!propio) return null;

  return (
    <>
      <CajonCarritoVista
        nombreViandera={nombreViandera}
        carrito={propio}
        platos={platos}
        abierto={false}
        onAbrir={() => setAbierto(true)}
        onCerrar={() => setAbierto(false)}
        onIncrementar={incrementar}
        onDecrementar={decrementar}
        onVaciar={() => confirmacionRef.current?.showModal()}
        dialogRef={dialogRef}
      />
      <dialog ref={confirmacionRef} aria-labelledby="titulo-vaciar-carrito" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-line bg-card p-5 text-ink shadow-xl backdrop:bg-ink/40">
        <h2 id="titulo-vaciar-carrito" className="font-display text-xl font-bold">¿Vaciar tu pedido?</h2>
        <p className="mt-2 text-sm text-ink-muted">Se quitarán todos los platos que elegiste.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={() => { vaciar(); confirmacionRef.current?.close(); setAbierto(false); }} className={`min-h-[44px] flex-1 rounded-full bg-coral-600 px-4 text-sm font-semibold text-white ${foco}`}>Sí, vaciar</button>
          <button type="button" onClick={() => confirmacionRef.current?.close()} className={`min-h-[44px] flex-1 rounded-full border border-line px-4 text-sm font-semibold ${foco}`}>Conservar pedido</button>
        </div>
      </dialog>
    </>
  );
}
