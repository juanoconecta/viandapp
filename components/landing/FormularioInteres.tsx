"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { anotarseComoInteresada } from "@/app/(consumer)/actions";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { IconCheck } from "./icons";

export default function FormularioInteres() {
  const [estado, formAction] = useActionState(anotarseComoInteresada, {
    status: "idle",
  });

  if (estado.status === "ok") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-2 rounded-3xl border border-ink/10 bg-card p-6 py-10 text-center shadow-sm sm:p-8"
      >
        <IconCheck className="h-10 w-10 text-teal" />
        <p className="font-display text-lg font-semibold text-teal">
          ¡Listo, ya estás anotada!
        </p>
        <p className="text-sm text-ink/60">
          Te vamos a contactar apenas abramos tu zona en Rafaela.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nombre" className="text-sm font-medium text-ink/80">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              className={campoClase}
              placeholder="Tu nombre"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="contacto" className="text-sm font-medium text-ink/80">
              WhatsApp
            </label>
            <input
              id="contacto"
              name="contacto"
              type="text"
              inputMode="tel"
              required
              className={campoClase}
              placeholder="Ej: 3492 123456"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="zona" className="text-sm font-medium text-ink/80">
              Zona o barrio <span className="text-ink/40">(opcional)</span>
            </label>
            <input
              id="zona"
              name="zona"
              type="text"
              className={campoClase}
              placeholder="Ej: Barrio Fátima"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="instagram" className="text-sm font-medium text-ink/80">
              Instagram <span className="text-ink/40">(opcional)</span>
            </label>
            <input
              id="instagram"
              name="instagram"
              type="text"
              className={campoClase}
              placeholder="@tu_usuario"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="mensaje" className="text-sm font-medium text-ink/80">
            Contanos sobre tus viandas <span className="text-ink/40">(opcional)</span>
          </label>
          <textarea
            id="mensaje"
            name="mensaje"
            rows={3}
            className={`${campoClase} resize-none`}
            placeholder="Qué cocinás, hace cuánto, etc."
          />
        </div>

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        <div>
          <BotonEnviar label="Quiero anotarme" labelEnviando="Enviando..." />
        </div>
      </form>
    </div>
  );
}
