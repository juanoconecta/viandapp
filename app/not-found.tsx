import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 py-16 text-center sm:px-6">
      <p className="font-display text-5xl font-bold text-coral">404</p>
      <h1 className="font-display text-xl font-bold text-ink">
        No encontramos esta página
      </h1>
      <p className="text-ink/60">
        Puede que el link esté mal escrito o que la página ya no exista.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-coral px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-coral-600 hover:shadow-md active:scale-95"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
