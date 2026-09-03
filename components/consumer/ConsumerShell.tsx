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
 */
export default function ConsumerShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px]">
      <DesktopSidebar />
      <main className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
