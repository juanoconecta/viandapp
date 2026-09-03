import Link from "next/link";
import type { TipoVianda } from "@/types";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";

const TIPO_ETIQUETA: Record<string, string> = {
  almuerzo: "Almuerzo",
  cena: "Cena",
  ambos: "Almuerzo y cena",
};

export type PlatoStorefront = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  tipo: TipoVianda;
  fotoUrl: string | null;
  etiquetas: string[];
};

/**
 * La selección de plato vive en la URL (`?plato=<id>`), no en estado de
 * cliente — mismo patrón que los filtros de `/explorar`. Por eso esta
 * tarjeta puede ser un Server Component: es un `<Link>` que activa o
 * desactiva su propia selección al navegar (sin scroll-jump gracias a
 * `scroll={false}`), y `page.tsx` decide qué plato está seleccionado leyendo
 * `searchParams`.
 *
 * Sin `aria-current`: el href de una tarjeta seleccionada apunta a la URL
 * que la DESELECCIONA, así que ese destino no es "la ubicación actual" —
 * mismo criterio ya aplicado en `FilterChips`. El estado seleccionado se
 * comunica con texto `sr-only`.
 */
export default function PublicDishCard({
  plato,
  seleccionado,
  hrefSeleccion,
}: {
  plato: PlatoStorefront;
  seleccionado: boolean;
  hrefSeleccion: string;
}) {
  return (
    <li>
      <Link
        href={hrefSeleccion}
        scroll={false}
        className={`flex gap-3 px-5 py-3.5 transition-colors focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-teal ${
          seleccionado ? "bg-soft-teal" : "hover:bg-soft-teal/40"
        }`}
      >
        {plato.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={plato.fotoUrl}
            alt={plato.nombre}
            className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-soft-teal text-center text-[10px] text-ink-muted">
            Sin foto
          </div>
        )}
        <div className="flex flex-1 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-ink">
              {plato.nombre}
              {seleccionado && <span className="sr-only"> (seleccionado)</span>}
            </p>
            {plato.descripcion && (
              <p className="mt-0.5 text-xs text-ink-muted">
                {plato.descripcion}
              </p>
            )}
            <p className="text-xs text-ink-muted">
              {TIPO_ETIQUETA[plato.tipo] ?? plato.tipo}
            </p>
            {plato.etiquetas.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {plato.etiquetas.map((valor) => {
                  const et = ETIQUETAS_DIETARIAS.find(
                    (e) => e.valor === valor,
                  );
                  return et ? (
                    <span
                      key={valor}
                      className="rounded-full bg-soft-teal px-2 py-0.5 text-[10px] font-medium text-teal"
                    >
                      {et.etiqueta}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
          {plato.precio != null && (
            <p className="whitespace-nowrap font-display text-sm font-semibold text-coral">
              ${plato.precio.toLocaleString("es-AR")}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
