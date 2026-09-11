import type { ReactNode } from "react";
import Link from "next/link";
import { cerrarSesion } from "@/app/auth/actions";
import { itemsAdmin } from "@/lib/admin/navegacion";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-ink">
          Administración de ViandApp
        </h1>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="px-3 py-3 text-sm font-medium text-ink/60 transition-colors hover:text-coral"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-ink/10 pb-4">
        {itemsAdmin.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-ink/70 transition-colors hover:bg-card hover:text-ink"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
