import Link from "next/link";
import { IconBuscar, IconInicio, IconSumar } from "./icons";

const ITEMS = [
  { href: "/", label: "Inicio", Icon: IconInicio },
  { href: "/explorar", label: "Explorar", Icon: IconBuscar },
] as const;

export default function DesktopSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-line bg-card/60 px-4 py-6 lg:block">
      <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        Explorar
      </p>
      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink transition-colors hover:bg-soft-teal hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl bg-soft-coral p-4">
        <p className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <IconSumar className="h-5 w-5 shrink-0 text-coral" />
          ¿Cocinás viandas?
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Mostrá tu menú a toda Rafaela.
        </p>
        <Link
          href="/#sumate"
          className="mt-3 flex min-h-[44px] items-center justify-center rounded-full bg-coral-600 px-4 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          Sumar mi cocina
        </Link>
      </div>
    </aside>
  );
}
