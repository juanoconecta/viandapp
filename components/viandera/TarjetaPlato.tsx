"use client";

import Link from "next/link";
import { alternarDisponibilidad, borrarPlato } from "@/app/viandera/actions";
import type { TipoVianda } from "@/types";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";

type Plato = {
  id: string;
  nombre: string;
  precio: number | null;
  tipo: TipoVianda;
  foto_url: string | null;
  disponible: boolean;
  etiquetas: string[];
};

export default function TarjetaPlato({ plato }: { plato: Plato }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-ink/10 bg-card p-4 shadow-sm">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-paper">
        {plato.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={plato.foto_url}
            alt={plato.nombre}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="font-display text-base font-semibold text-ink">
          {plato.nombre}
        </p>
        <p className="text-xs uppercase tracking-wide text-ink/40">
          {plato.tipo}
        </p>
        {plato.precio != null && (
          <p className="text-sm font-medium text-coral">
            ${plato.precio.toLocaleString("es-AR")}
          </p>
        )}

        {plato.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {plato.etiquetas.map((valor) => {
              const et = ETIQUETAS_DIETARIAS.find((e) => e.valor === valor);
              return et ? (
                <span
                  key={valor}
                  className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700"
                >
                  {et.etiqueta}
                </span>
              ) : null;
            })}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <form action={alternarDisponibilidad}>
            <input type="hidden" name="viandaId" value={plato.id} />
            <input
              type="hidden"
              name="disponible"
              value={String(plato.disponible)}
            />
            <button
              type="submit"
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                plato.disponible
                  ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                  : "bg-ink/10 text-ink/50 hover:bg-ink/15"
              }`}
            >
              {plato.disponible ? "Disponible" : "No disponible"}
            </button>
          </form>

          <Link
            href={`/viandera/platos/${plato.id}/editar`}
            className="px-1 py-3 text-xs font-medium text-ink/60 hover:text-coral"
          >
            Editar
          </Link>

          <form
            action={borrarPlato}
            onSubmit={(e) => {
              if (!window.confirm(`¿Borrar "${plato.nombre}"?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="viandaId" value={plato.id} />
            <button
              type="submit"
              className="px-1 py-3 text-xs font-medium text-ink/60 hover:text-coral"
            >
              Borrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
