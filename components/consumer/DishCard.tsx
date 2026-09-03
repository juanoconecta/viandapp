import Link from "next/link";
import type { ResultadoPlato } from "@/lib/viandas/consultas";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";

const TIPO_ETIQUETA: Record<string, string> = {
  almuerzo: "Almuerzo",
  cena: "Cena",
  ambos: "Almuerzo y cena",
};

function modalidadTexto(viandera: ResultadoPlato["viandera"]): string {
  if (viandera.ofreceRetiro && viandera.ofreceEnvio) return "Retiro y envío";
  if (viandera.ofreceRetiro) return "Retiro";
  if (viandera.ofreceEnvio) return "Envío";
  return "";
}

export default function DishCard({ plato }: { plato: ResultadoPlato }) {
  const modalidad = modalidadTexto(plato.viandera);

  return (
    <Link
      href={`/${plato.viandera.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-soft-teal">
        {plato.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={plato.fotoUrl}
            alt={plato.nombre}
            className="h-full w-full object-cover motion-safe:transition-transform motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-ink-muted">
            Sin foto
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="font-display text-base font-semibold leading-tight text-ink">
          {plato.nombre}
        </p>
        <p className="text-xs text-ink-muted">
          {plato.viandera.nombre}
          {plato.viandera.barrio ? ` · ${plato.viandera.barrio}` : ""}
        </p>
        <p className="text-xs text-ink-muted">
          {TIPO_ETIQUETA[plato.tipo] ?? plato.tipo}
          {modalidad ? ` · ${modalidad}` : ""}
        </p>

        {plato.etiquetas.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {plato.etiquetas.slice(0, 2).map((valor) => {
              const et = ETIQUETAS_DIETARIAS.find((e) => e.valor === valor);
              return et ? (
                <span
                  key={valor}
                  className="rounded-full bg-soft-teal px-2 py-0.5 text-[10px] font-medium text-teal"
                >
                  {et.etiqueta}
                </span>
              ) : null;
            })}
            {plato.etiquetas.length > 2 && (
              <span className="rounded-full bg-line/60 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                +{plato.etiquetas.length - 2}
              </span>
            )}
          </div>
        )}

        <p className="mt-auto pt-1 font-display text-sm font-semibold text-coral">
          {plato.precio != null
            ? `$${plato.precio.toLocaleString("es-AR")}`
            : "$—"}
        </p>
      </div>
    </Link>
  );
}
