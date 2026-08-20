import Link from "next/link";
import LogoIcon from "./LogoIcon";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoIcon className="h-9 w-auto" />
          <span className="text-xl font-medium">
            <span className="text-neutral-900">viand</span>
            <span className="text-coral">app</span>
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/productores"
            className="hidden text-sm font-medium text-neutral-600 hover:text-neutral-900 sm:block"
          >
            Sumarte como viandera
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-600"
          >
            Ingresar
          </Link>
        </nav>
      </div>
    </header>
  );
}
