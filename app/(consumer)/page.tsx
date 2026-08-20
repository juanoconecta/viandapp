import Filtros from "@/components/viandas/Filtros";
import ViandaList from "@/components/viandas/ViandaList";
import ViandaMapLoader from "@/components/map/ViandaMapLoader";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="flex flex-col gap-2 text-center sm:text-left">
        <h1 className="text-3xl font-medium text-neutral-900 sm:text-4xl">
          Encontrá tu viandera más cerca
        </h1>
        <p className="text-neutral-500">
          Viandas caseras en Rafaela — pedí sin intermediarios
        </p>
      </section>

      <Filtros />

      <ViandaMapLoader />

      <ViandaList />
    </div>
  );
}
