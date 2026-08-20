import type { Vianda } from "@/types";

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center">
      <span className="text-4xl">🍽️</span>
      <p className="text-lg font-medium text-neutral-900">
        Próximamente viandas en tu zona
      </p>
      <p className="max-w-md text-sm text-neutral-500">
        Estamos sumando las primeras vianderas de Rafaela. Anotate para ser el
        primero en enterarte.
      </p>
      <a
        href="https://forms.gle/placeholder"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 rounded-full bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-600"
      >
        Quiero anotarme
      </a>
    </div>
  );
}

export default function ViandaList({ viandas = [] }: { viandas?: Vianda[] }) {
  if (viandas.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {viandas.map((vianda) => (
        <div key={vianda.id} className="rounded-2xl border border-neutral-200 p-4">
          <p className="font-medium text-neutral-900">{vianda.nombre}</p>
        </div>
      ))}
    </div>
  );
}
