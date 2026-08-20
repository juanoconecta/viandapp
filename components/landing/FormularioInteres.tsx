"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { anotarseComoInteresada } from "@/app/(consumer)/actions";

function BotonEnviar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Quiero anotarme"}
    </button>
  );
}

export default function FormularioInteres() {
  const [estado, formAction] = useActionState(anotarseComoInteresada, {
    status: "idle",
  });

  if (estado.status === "ok") {
    return (
      <div className="rounded-2xl border border-teal/30 bg-teal/5 p-6 text-center">
        <p className="font-medium text-teal">¡Listo, ya estás anotada!</p>
        <p className="mt-1 text-sm text-neutral-600">
          Te vamos a contactar apenas abramos tu zona en Rafaela.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium text-neutral-700">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-coral focus:outline-none"
            placeholder="Tu nombre"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contacto" className="text-sm font-medium text-neutral-700">
            WhatsApp o email
          </label>
          <input
            id="contacto"
            name="contacto"
            type="text"
            required
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-coral focus:outline-none"
            placeholder="Cómo te contactamos"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="zona" className="text-sm font-medium text-neutral-700">
          Zona o barrio <span className="text-neutral-400">(opcional)</span>
        </label>
        <input
          id="zona"
          name="zona"
          type="text"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-coral focus:outline-none"
          placeholder="Ej: Barrio Fátima"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="mensaje" className="text-sm font-medium text-neutral-700">
          Contanos sobre tus viandas <span className="text-neutral-400">(opcional)</span>
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          rows={3}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-coral focus:outline-none"
          placeholder="Qué cocinás, hace cuánto, etc."
        />
      </div>

      {estado.status === "error" && (
        <p className="text-sm text-red-600">{estado.mensaje}</p>
      )}

      <div>
        <BotonEnviar />
      </div>
    </form>
  );
}
