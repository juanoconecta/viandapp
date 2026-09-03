import type { ReactNode } from "react";

/**
 * `position: sticky`, no `fixed` — a propósito. Un elemento fijo a la
 * ventana necesitaría el mismo despeje que ya le tuvimos que agregar al
 * Footer global por `MobileBottomNav` en `/explorar` (ver
 * `app/globals.css`). Al quedar `sticky` en vez de `fixed`, nunca llega a
 * superponerse con el Footer: se despega apenas termina de scrollearse la
 * tarjeta del perfil, y sigue el scroll normal de la página como cualquier
 * otro contenido a partir de ahí.
 *
 * Vive FUERA del `overflow-hidden` que envuelve el header y el menú en
 * `page.tsx` a propósito — verificado en vivo con una lista larga: un
 * ancestro con `overflow` distinto de `visible` acota el rango de
 * "pegado" de un `sticky` a los límites de ESE ancestro, y como esa caja
 * no tiene scroll propio (la página entera es lo que se scrollea), la
 * barra quedaba pegada al final del menú en vez de perseguir el scroll
 * real — nunca se mantenía visible mientras se recorría la lista. Sacarla
 * de ese contenedor devuelve el `sticky` a mirar hasta el verdadero
 * contenedor con scroll (la ventana).
 *
 * `page.tsx` la renderiza solo cuando hay un teléfono utilizable
 * (`telefonoParaWhatsapp`) — por eso este borde/padding nunca aparece
 * vacío cuando no hay CTA que mostrar.
 */
export default function StickyContactBar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 rounded-b-3xl border border-t-0 border-ink/10 bg-card/95 px-5 py-4 backdrop-blur-sm">
      {children}
    </div>
  );
}
