import type { Metadata } from "next";
import { Suspense } from "react";
import ConsumerShell from "@/components/consumer/ConsumerShell";
import GlobalSearch from "@/components/consumer/GlobalSearch";
import FilterChips from "@/components/consumer/FilterChips";
import DishCard from "@/components/consumer/DishCard";
import EmptyState from "@/components/consumer/EmptyState";
import ResultsSkeleton from "@/components/consumer/ResultsSkeleton";
import { parsearFiltros, type FiltrosExplorador } from "@/lib/viandas/filtros";
import { buscarPlatos } from "@/lib/viandas/consultas";

export const metadata: Metadata = {
  title: "Explorar viandas — ViandApp",
  description: "Buscá viandas caseras cerca tuyo en Rafaela, Santa Fe.",
};

type BusquedaParams = Record<string, string | string[] | undefined>;

function filtrosComoOcultos(
  filtros: FiltrosExplorador,
): Record<string, string> {
  const ocultos: Record<string, string> = {};
  if (filtros.tipo !== "todos") ocultos.tipo = filtros.tipo;
  if (filtros.etiqueta) ocultos.etiqueta = filtros.etiqueta;
  if (filtros.modalidad !== "todas") ocultos.modalidad = filtros.modalidad;
  return ocultos;
}

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<BusquedaParams>;
}) {
  const params = await searchParams;
  const filtros = parsearFiltros(params);

  return (
    <ConsumerShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          Viandas cerca tuyo
        </h1>

        <div className="mt-4 sm:max-w-xl">
          <GlobalSearch
            initialQuery={filtros.q}
            filtrosActuales={filtrosComoOcultos(filtros)}
          />
        </div>

        <div className="mt-4">
          <FilterChips filtros={filtros} />
        </div>

        <div className="mt-6">
          <Suspense fallback={<ResultsSkeleton />}>
            <Resultados filtros={filtros} />
          </Suspense>
        </div>
      </div>
    </ConsumerShell>
  );
}

async function Resultados({ filtros }: { filtros: FiltrosExplorador }) {
  // `buscarPlatos` lanza ante un error real de consulta — no lo atrapamos
  // acá a propósito, así llega a `app/explorar/error.tsx`. Solo se llega
  // más abajo cuando la consulta resolvió bien.
  const platos = await buscarPlatos(filtros);

  if (platos.length === 0) {
    return <EmptyState filtros={filtros} />;
  }

  if (platos.length === 1) {
    return (
      <div className="mx-auto max-w-sm">
        <DishCard plato={platos[0]} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {platos.map((plato) => (
        <DishCard key={plato.id} plato={plato} />
      ))}
    </div>
  );
}
