import type { ReactNode } from "react";
import { cerrarSesion } from "@/app/auth/actions";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex justify-end">
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
