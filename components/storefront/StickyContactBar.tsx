import type { ReactNode } from "react";

/**
 * `position: sticky`, no `fixed` — a propósito. Un elemento fijo a la
 * ventana necesitaría el mismo despeje que ya le tuvimos que agregar al
 * Footer global por `MobileBottomNav` en `/explorar` (ver
 * `app/globals.css`). Al quedar `sticky` dentro de la tarjeta del perfil,
 * deja de "pegarse" apenas se termina de scrollear esa tarjeta —
 * nunca llega a superponerse con el Footer, que viene después.
 */
export default function StickyContactBar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-ink/10 bg-paper/90 px-5 py-4 backdrop-blur-sm">
      {children}
    </div>
  );
}
