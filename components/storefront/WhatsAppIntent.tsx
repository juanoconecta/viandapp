"use client";

import { useRef } from "react";
import { telefonoParaWhatsapp } from "@/lib/viandera/telefono";

type PlatoElegido = { id: string; nombre: string } | null;

function construirMensaje(plato: PlatoElegido): string {
  return plato
    ? `Hola, vi tu perfil en ViandApp. Quería consultar por ${plato.nombre}. ¿Está disponible?`
    : "Hola, vi tu perfil en ViandApp. Quería consultar por tus viandas.";
}

/**
 * Trigger + diálogo de confirmación en un solo componente: los dos
 * necesitan compartir el `ref` del `<dialog>` nativo, así que separarlos
 * en dos archivos solo para coincidir 1:1 con nombres del plan hubiera
 * significado inventar un tercer componente (o contexto de React) nada más
 * para pasar ese ref — más complejidad, no menos.
 *
 * Usa `<dialog>` nativo en vez de un modal armado a mano: el navegador ya
 * resuelve gratis el cierre con Escape y la devolución de foco al
 * disparador cuando se llama `close()` — exactamente los dos requisitos
 * del plan. Sin animación de apertura/cierre propia: `prefers-reduced-motion`
 * ya no tiene nada que reducir acá (la regla global en `globals.css` de
 * todas formas neutraliza cualquier transición si algún navegador le
 * agrega una por su cuenta).
 *
 * Si no hay teléfono, o el que hay no deja suficientes dígitos utilizables
 * (ver `telefonoParaWhatsapp`), no se renderiza nada — nunca un botón
 * deshabilitado sin explicación, ni un link roto a `wa.me`.
 */
export default function WhatsAppIntent({
  telefono,
  nombreViandera,
  plato,
}: {
  telefono: string | null;
  nombreViandera: string;
  plato: PlatoElegido;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const numeroLimpio = telefonoParaWhatsapp(telefono);

  if (!numeroLimpio) return null;

  const mensaje = construirMensaje(plato);
  const whatsappHref = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;

  const cerrar = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-coral-600 px-6 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
      >
        {plato ? `Consultar por ${plato.nombre}` : "Consultar por WhatsApp"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="whatsapp-intent-titulo"
        onClick={(evento) => {
          if (evento.target === dialogRef.current) cerrar();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <div className="p-5">
          <h2
            id="whatsapp-intent-titulo"
            className="font-display text-lg font-bold text-ink"
          >
            Vas a escribirle por WhatsApp
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            La disponibilidad, la entrega y el pago se coordinan
            directamente con {nombreViandera}, fuera de ViandApp.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={cerrar}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-coral-600 px-4 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
            >
              Continuar a WhatsApp
            </a>
            <button
              type="button"
              onClick={cerrar}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-soft-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
