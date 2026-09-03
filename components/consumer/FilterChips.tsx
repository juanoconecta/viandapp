import Link from "next/link";
import type { ReactNode } from "react";
import type { FiltrosExplorador } from "@/lib/viandas/filtros";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";

const OPCIONES_TIPO = [
  { valor: "almuerzo", etiqueta: "Almuerzo" },
  { valor: "cena", etiqueta: "Cena" },
] as const;

const OPCIONES_MODALIDAD = [
  { valor: "retiro", etiqueta: "Retiro" },
  { valor: "envio", etiqueta: "Envío" },
] as const;

function construirHref(
  filtros: FiltrosExplorador,
  cambios: Partial<FiltrosExplorador>,
): string {
  const combinados = { ...filtros, ...cambios };
  const params = new URLSearchParams();

  if (combinados.q) params.set("q", combinados.q);
  if (combinados.tipo !== "todos") params.set("tipo", combinados.tipo);
  if (combinados.etiqueta) params.set("etiqueta", combinados.etiqueta);
  if (combinados.modalidad !== "todas") {
    params.set("modalidad", combinados.modalidad);
  }

  const query = params.toString();
  return query ? `/explorar?${query}` : "/explorar";
}

function Chip({
  activo,
  href,
  children,
}: {
  activo: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-pressed={activo}
      className={`flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        activo
          ? "border-teal-200 bg-soft-teal text-teal"
          : "border-line bg-card text-ink hover:bg-soft-teal/60"
      }`}
    >
      {children}
    </Link>
  );
}

export default function FilterChips({
  filtros,
}: {
  filtros: FiltrosExplorador;
}) {
  const cantidadFiltrosActivos = [
    filtros.tipo !== "todos",
    filtros.etiqueta !== null,
    filtros.modalidad !== "todas",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
      {OPCIONES_TIPO.map((opcion) => {
        const activo = filtros.tipo === opcion.valor;
        return (
          <Chip
            key={opcion.valor}
            activo={activo}
            href={construirHref(filtros, {
              tipo: activo ? "todos" : opcion.valor,
            })}
          >
            {opcion.etiqueta}
          </Chip>
        );
      })}

      {OPCIONES_MODALIDAD.map((opcion) => {
        const activo = filtros.modalidad === opcion.valor;
        return (
          <Chip
            key={opcion.valor}
            activo={activo}
            href={construirHref(filtros, {
              modalidad: activo ? "todas" : opcion.valor,
            })}
          >
            {opcion.etiqueta}
          </Chip>
        );
      })}

      {ETIQUETAS_DIETARIAS.map((opcion) => {
        const activo = filtros.etiqueta === opcion.valor;
        return (
          <Chip
            key={opcion.valor}
            activo={activo}
            href={construirHref(filtros, {
              etiqueta: activo ? null : opcion.valor,
            })}
          >
            {opcion.etiqueta}
          </Chip>
        );
      })}

      {cantidadFiltrosActivos >= 2 && (
        <Link
          href={construirHref(filtros, {
            tipo: "todos",
            etiqueta: null,
            modalidad: "todas",
          })}
          className="flex min-h-[44px] shrink-0 items-center px-2 text-sm font-medium text-coral-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          Limpiar todo
        </Link>
      )}
    </div>
  );
}
