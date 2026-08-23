import type { ReactNode } from "react";
import Link from "next/link";
import { cerrarSesion } from "@/app/auth/actions";

export default function VianderaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/viandera/perfil"
          className="px-3 py-3 text-sm font-medium text-ink/60 transition-colors hover:text-coral"
        >
          Editar perfil
        </Link>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="px-3 py-3 text-sm font-medium text-ink/60 transition-colors hover:text-coral"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
