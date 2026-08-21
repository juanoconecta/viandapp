"use client";

import { motion, useReducedMotion } from "motion/react";
import { IconPlato, IconChispa } from "./icons";

const TARJETAS = [
  {
    Icon: IconPlato,
    iconClase: "text-coral",
    titulo: "Hoy: Milanesa con puré",
    nota: "Doña Rosa — Barrio Fátima",
    rotate: -4,
    x: 0,
    y: 0,
    className: "bg-card text-ink z-20 w-56 sm:w-64",
  },
  {
    Icon: IconPlato,
    iconClase: "text-teal",
    titulo: "Tarta de verdura",
    nota: "$3.500 · retiro o envío",
    rotate: 6,
    x: 120,
    y: 90,
    className: "bg-card text-ink z-10 w-48 sm:w-56",
  },
  {
    Icon: IconChispa,
    iconClase: "text-white",
    titulo: "Sin comisión",
    nota: null,
    rotate: -9,
    x: 176,
    y: -46,
    className: "bg-coral text-white z-30 w-32 sm:w-36",
  },
] as const;

export default function TarjetasVianda() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative mx-auto h-64 w-full max-w-sm sm:h-72">
      {TARJETAS.map((tarjeta, i) => (
        <motion.div
          key={tarjeta.titulo}
          initial={{ opacity: 0, y: tarjeta.y + 30, rotate: 0, scale: 0.9 }}
          animate={{
            opacity: 1,
            y: prefersReducedMotion
              ? tarjeta.y
              : [tarjeta.y, tarjeta.y - 6, tarjeta.y],
            rotate: tarjeta.rotate,
            scale: 1,
          }}
          transition={{
            opacity: { duration: 0.5, delay: 0.15 * i },
            scale: { duration: 0.5, delay: 0.15 * i },
            rotate: { duration: 0.5, delay: 0.15 * i },
            y: prefersReducedMotion
              ? { duration: 0.5, delay: 0.15 * i }
              : {
                  duration: 4 + i,
                  delay: 0.6 + 0.15 * i,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
          }}
          style={{ left: tarjeta.x, top: 40 }}
          className={`absolute rounded-2xl border border-ink/10 p-4 shadow-[0_8px_24px_-8px_rgba(54,36,23,0.25)] ${tarjeta.className}`}
        >
          <tarjeta.Icon className={`h-6 w-6 ${tarjeta.iconClase}`} />
          <p className="mt-2 font-display text-sm font-semibold leading-snug">
            {tarjeta.titulo}
          </p>
          {tarjeta.nota && (
            <p
              className={`mt-0.5 text-xs ${
                tarjeta.titulo === "Tarta de verdura"
                  ? "font-semibold text-mostaza-700"
                  : "opacity-70"
              }`}
            >
              {tarjeta.nota}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
