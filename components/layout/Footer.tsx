import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-sm text-ink/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p>viandapp © 2026 — Rafaela, Santa Fe</p>
          <p className="text-xs text-ink/50">
            un desarrollo de{" "}
            <a
              href="https://juanoconecta.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-coral transition-colors hover:underline hover:text-coral-600"
            >
              JuanoConecta
            </a>
          </p>
        </div>
        <Link
          href="/#sumate"
          className="py-3 font-medium text-coral transition-colors hover:text-coral-600"
        >
          ¿Hacés viandas? Sumarte →
        </Link>
      </div>
    </footer>
  );
}
