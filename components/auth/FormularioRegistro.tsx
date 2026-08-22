"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { registrarse, iniciarSesionConGoogle, type EstadoAuth } from "@/app/auth/actions";

const campoClase =
  "rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink placeholder:text-ink/35 transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

const estadoInicial: EstadoAuth = { status: "idle" };

function BotonEnviar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
    >
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </button>
  );
}

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

        <BotonEnviar />
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink/10" />
        <span className="text-xs text-ink/40">o</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>

      <form action={iniciarSesionConGoogle}>
        <input type="hidden" name="redirect" value="/app" />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-card"
        >
          Continuar con Google
        </button>
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
