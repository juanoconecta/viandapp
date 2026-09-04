import Link from "next/link";

const FILTROS_RAPIDOS = [
  { etiqueta: "Almuerzo", href: "/explorar?tipo=almuerzo" },
  { etiqueta: "Cena", href: "/explorar?tipo=cena" },
  { etiqueta: "Retiro", href: "/explorar?modalidad=retiro" },
  { etiqueta: "Envío", href: "/explorar?modalidad=envio" },
] as const;

export default function HeroQuickFilters() {
  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
      {FILTROS_RAPIDOS.map((filtro) => (
        <Link
          key={filtro.href}
          href={filtro.href}
          className="flex min-h-[44px] shrink-0 items-center rounded-full bg-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {filtro.etiqueta}
        </Link>
      ))}
    </div>
  );
}
