"use client";

import { useState } from "react";
import type { TipoVianda } from "@/types";

const OPCIONES: { value: TipoVianda; label: string }[] = [
  { value: "almuerzo", label: "Almuerzo" },
  { value: "cena", label: "Cena" },
  { value: "ambos", label: "Ambos" },
];

export default function Filtros() {
  const [tipo, setTipo] = useState<TipoVianda>("ambos");
  const [conEnvio, setConEnvio] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPCIONES.map((opcion) => {
        const activo = tipo === opcion.value;
        return (
          <button
            key={opcion.value}
            type="button"
            onClick={() => setTipo(opcion.value)}
            aria-pressed={activo}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activo
                ? "bg-coral text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {opcion.label}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setConEnvio((prev) => !prev)}
        aria-pressed={conEnvio}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          conEnvio
            ? "bg-teal text-white"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
        }`}
      >
        Con envío
      </button>
    </div>
  );
}
