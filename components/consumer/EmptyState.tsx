import Link from "next/link";
import type { FiltrosExplorador } from "@/lib/viandas/filtros";
import { IconBuscar } from "./icons";

function hayFiltrosActivos(filtros: FiltrosExplorador): boolean {
  return (
    filtros.q !== "" ||
    filtros.tipo !== "todos" ||
    filtros.etiqueta !== null ||
    filtros.modalidad !== "todas"
  );
}

export default function EmptyState({
  filtros,
}: {
  filtros: FiltrosExplorador;
}) {
  const conFiltros = hayFiltrosActivos(filtros);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-coral">
        <IconBuscar className="h-6 w-6 text-coral" />
      </span>
      <p className="text-lg font-medium text-ink">
        No encontramos opciones con esos criterios
      </p>
      <p className="max-w-md text-sm text-ink-muted">
        {conFiltros
          ? "Probá ampliar la búsqueda o quitar algún filtro."
          : "Todavía no hay viandas cargadas — estamos sumando las primeras cocinas de Rafaela."}
      </p>
      {conFiltros && (
        <Link
          href="/explorar"
          className="mt-2 flex min-h-[44px] items-center rounded-full bg-coral-600 px-6 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          Ver todas las viandas
        </Link>
      )}
    </div>
  );
}
