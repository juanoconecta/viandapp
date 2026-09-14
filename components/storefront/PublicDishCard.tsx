import type { TipoVianda } from "@/types";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";
import BotonAgregarAlCarrito from "@/components/carrito/BotonAgregarAlCarrito";

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

export default function PublicDishCard({
  vianderaId,
  plato,
}: {
  vianderaId: string;
  plato: PlatoStorefront;
}) {
  return (
    <li className="flex gap-3 px-5 py-4">
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
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-ink">
              {plato.nombre}
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
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            {plato.precio != null && <p className="whitespace-nowrap font-display text-sm font-semibold text-coral">${plato.precio.toLocaleString("es-AR")}</p>}
            {plato.precio != null && <BotonAgregarAlCarrito vianderaId={vianderaId} platoId={plato.id} nombre={plato.nombre} />}
          </div>
        </div>
    </li>
  );
}
