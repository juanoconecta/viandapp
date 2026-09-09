"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registrarse, type EstadoAuth } from "@/app/auth/actions";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";

const estadoInicial: EstadoAuth = { status: "idle" };

export default function FormularioRegistro() {
  const [estado, formAction] = useActionState(registrarse, estadoInicial);

  return (
    <div className="rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
      <form action={formAction} className="flex flex-col gap-4">
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
          <label htmlFor="email" className="text-sm font-medium text-ink/80">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={campoClase}
            placeholder="vos@ejemplo.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-ink/80">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className={campoClase}
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        {estado.status === "error" && (
          <p className="text-sm text-coral-700" role="alert">
            {estado.mensaje}
          </p>
        )}

        {estado.status === "verificar" && (
          <p className="text-sm text-teal-700" role="status">
            {estado.mensaje}
          </p>
        )}

        <BotonEnviar label="Crear cuenta" labelEnviando="Creando cuenta..." />
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-coral hover:text-coral-600">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
