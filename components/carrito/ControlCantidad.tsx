"use client";

import { MAX_CANTIDAD_ITEM } from "@/lib/carrito/estado";

const claseBoton = "min-h-[44px] min-w-[44px] rounded-full border border-teal text-teal transition-colors hover:bg-soft-teal disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600";

export default function ControlCantidad({
  nombre,
  cantidad,
  onIncrementar,
  onDecrementar,
}: {
  nombre: string;
  cantidad: number;
  onIncrementar: () => void;
  onDecrementar: () => void;
}) {
  const maximoAlcanzado = cantidad >= MAX_CANTIDAD_ITEM;

  return (
    <div className="flex items-center gap-1" aria-label={`Cantidad de ${nombre}`}>
      <button type="button" onClick={onDecrementar} aria-label={`Quitar una ${nombre}`} className={claseBoton}>−</button>
      <output aria-live="polite" className="min-w-7 text-center font-display font-bold text-ink">{cantidad}</output>
      <button
        type="button"
        onClick={onIncrementar}
        disabled={maximoAlcanzado}
        aria-label={maximoAlcanzado ? `Agregar una ${nombre} (máximo alcanzado)` : `Agregar una ${nombre}`}
        className={claseBoton}
      >+</button>
    </div>
  );
}
