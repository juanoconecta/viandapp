import Link from "next/link";
import { IconBuscar, IconInicio, IconSumar } from "./icons";

const ITEMS = [
  { href: "/", label: "Inicio", Icon: IconInicio },
  { href: "/explorar", label: "Explorar", Icon: IconBuscar },
  { href: "/#sumate", label: "Sumar mi cocina", Icon: IconSumar },
] as const;

/**
 * Cubre mobile y tablet (oculto recién en `lg`): el plan de esta entrega
 * no incluye un tercer componente de navegación compacta dedicado a
 * tablet, así que la navegación inferior es la que sirve "compacta" en
 * ambos anchos — el sidebar queda exclusivo de desktop.
 */
export default function MobileBottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      data-consumer-bottom-nav="true"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        {ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-center text-[10px] font-medium leading-tight text-ink-muted transition-colors hover:text-teal focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-teal"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
