import type { ReactNode } from "react";
import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";

/**
 * Shell de navegación secundaria para las páginas de descubrimiento del
 * consumidor (`/explorar` y afines). No duplica el `Header` global del
 * sitio (logo, "Ingresar"/"Mi cuenta") — ese sigue renderizando arriba de
 * esto desde `app/layout.tsx`, igual que ya pasa en `/app` y `/viandera`.
 * Solo agrega la navegación propia de esta sección: sidebar en desktop,
 * navegación inferior en mobile/tablet.
 *
 * El `<main>` del documento ya lo pone `app/layout.tsx` alrededor de
 * `{children}` — este contenedor es un `<div>`, no otro `<main>`, para no
 * anidar dos landmarks "main" (HTML solo permite uno).
 */
export default function ConsumerShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px]">
      <DesktopSidebar />
      <div className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  );
}
