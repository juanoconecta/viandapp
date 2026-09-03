"use client";

import { useEffect } from "react";
import ConsumerShell from "@/components/consumer/ConsumerShell";

export default function ExplorarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[explorar] error de página", error);
  }, [error]);

  return (
    <ConsumerShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center sm:px-6">
        <p className="font-display text-3xl font-bold text-coral">¡Ups!</p>
        <h1 className="font-display text-xl font-bold text-ink">
          No pudimos cargar esta información
        </h1>
        <p className="text-ink-muted">
          Tu búsqueda y tus filtros siguen guardados. Revisá tu conexión y
          volvé a intentarlo.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-2 min-h-[44px] rounded-full bg-coral-600 px-6 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
        >
          Volver a intentar
        </button>
      </div>
    </ConsumerShell>
  );
}
