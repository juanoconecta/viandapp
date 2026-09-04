import Link from "next/link";
import LogoIcon from "./LogoIcon";
import { createClient } from "@/lib/supabase/server";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon className="h-9 w-auto" />
          <span className="font-display text-xl font-bold tracking-tight">
            <span className="text-ink">viand</span>
            <span className="text-coral">app</span>
          </span>
        </Link>

        <nav aria-label="Navegación global" className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/explorar"
            className="hidden py-3 text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:block"
          >
            Explorar
          </Link>
          <Link
            href="/#como-funciona"
            className="hidden py-3 text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:block"
          >
            Cómo funciona
          </Link>
          <Link
            href="/#sumate"
            className="hidden py-3 text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:block"
          >
            Sumar mi cocina
          </Link>
          {user ? (
            <Link
              href="/app"
              className="rounded-full border border-ink/15 px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-card"
            >
              Mi cuenta
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-coral px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-coral-600 hover:shadow-md active:scale-95"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
