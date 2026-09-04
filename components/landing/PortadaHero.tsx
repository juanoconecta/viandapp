import GlobalSearch from "@/components/consumer/GlobalSearch";
import HeroCarousel from "./HeroCarousel";
import HeroQuickFilters from "./HeroQuickFilters";
import { FOTOS_CARRUSEL } from "./carruselDatos";

export default function PortadaHero() {
  return (
    <section className="bg-teal">
      {/*
        Precarga solo la variante de la foto 0 (candidata a LCP) que
        corresponde al viewport real — el mismo corte lg (1024px) que usa
        el <picture> en HeroCarousel. `next/image` con `priority` precarga
        siempre la variante de escritorio incluso en mobile; estos dos
        <link> reemplazan esa precarga automática por una por breakpoint,
        así el navegador nunca baja ambas.
      */}
      <link
        rel="preload"
        as="image"
        type="image/avif"
        href="/portada/carrusel-01-desktop.avif"
        media="(min-width: 1024px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        type="image/avif"
        href="/portada/carrusel-01-mobile.avif"
        media="(max-width: 1023.98px)"
        fetchPriority="high"
      />
      {/*
        Tres composiciones según ancho, no dos:
        - < md (mobile): apilado, una columna — grid-cols-1 por defecto.
        - md–lg (768–1023): dos columnas compactas y contenidas (mismo
          contenedor con `max-w-6xl`, gap y padding que el resto del
          sitio) — evita texto comprimido sin llegar todavía al layout
          a sangre.
        - >= lg (1024): el hero se vuelve una sola composición
          horizontal a sangre — se cancelan `mx-auto`/`max-w-6xl`/
          padding/gap del contenedor (`lg:mx-0 lg:max-w-none lg:gap-0
          lg:px-0 lg:py-0`) para que la columna derecha (la foto) llegue
          hasta el borde real de la sección, sin ningún gap visual entre
          las dos mitades.
      */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-10 md:py-16 lg:mx-0 lg:max-w-none lg:items-stretch lg:gap-0 lg:px-0 lg:py-0">
        <div className="flex flex-col gap-5 lg:justify-center lg:py-16 lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:pr-12">
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
