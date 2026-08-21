import { IconPin } from "./icons";

const VIANDAS_EJEMPLO = [
  { nombre: "Milanesa con puré", precio: "$4.200", tipo: "Almuerzo" },
  { nombre: "Tarta de verdura", precio: "$3.500", tipo: "Ambos" },
  { nombre: "Guiso de lentejas", precio: "$3.800", tipo: "Cena" },
];

export default function PreviewPerfil() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-ink/10 bg-card shadow-lg shadow-ink/5">
      <div className="flex items-center gap-3 border-b border-ink/10 bg-teal px-5 py-4 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 font-display text-lg font-bold">
          DR
        </div>
        <div className="flex-1">
          <p className="font-display font-semibold leading-tight">Doña Rosa</p>
          <p className="flex items-center gap-1 text-xs text-white/75">
            <IconPin className="h-3.5 w-3.5" />
            Barrio Fátima, Rafaela
          </p>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
          Activa
        </span>
      </div>

      <ul className="divide-y divide-ink/10">
        {VIANDAS_EJEMPLO.map((vianda) => (
          <li key={vianda.nombre} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">{vianda.nombre}</p>
              <p className="text-xs text-ink/50">{vianda.tipo}</p>
            </div>
            <p className="font-display text-sm font-semibold text-coral">
              {vianda.precio}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-ink/10 bg-paper/60 px-5 py-4">
        <div className="pointer-events-none w-full rounded-full bg-coral/90 py-2.5 text-center text-sm font-medium text-white">
          Pedir por WhatsApp
        </div>
      </div>
    </div>
  );
}
