import GlobalSearch from "@/components/consumer/GlobalSearch";
import HeroCarousel from "./HeroCarousel";
import HeroQuickFilters from "./HeroQuickFilters";
import { FOTOS_CARRUSEL } from "./carruselDatos";

export default function PortadaHero() {
  return (
    <section className="bg-teal">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <div className="flex flex-col gap-5">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-white/70">
            Rafaela, Santa Fe
          </p>
          <h1 className="font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl">
            Hoy no cocines. Elegí casero.
          </h1>
          <p className="max-w-xl text-lg text-white/85">
            Encontrá viandas preparadas por cocinas de Rafaela. Mirá el
            menú y coordiná directo por WhatsApp.
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <GlobalSearch initialQuery="" />
            <HeroQuickFilters />
          </div>
        </div>

        <HeroCarousel fotos={FOTOS_CARRUSEL} />
      </div>
    </section>
  );
}
