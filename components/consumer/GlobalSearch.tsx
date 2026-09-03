import { IconBuscar } from "./icons";

type GlobalSearchProps = {
  initialQuery: string;
  /**
   * Filtros ya activos (ej. `{ tipo: "almuerzo", modalidad: "retiro" }`)
   * que deben viajar como campos ocultos para que una nueva búsqueda no
   * los pierda. Opcional: el contrato mínimo de esta tarea es solo
   * `initialQuery`, esto se completa recién cuando la Task 6 conecte una
   * búsqueda real con filtros de por medio.
   */
  filtrosActuales?: Record<string, string>;
};

const LARGO_MAXIMO_BUSQUEDA = 80;

export default function GlobalSearch({
  initialQuery,
  filtrosActuales = {},
}: GlobalSearchProps) {
  return (
    <form
      action="/explorar"
      method="GET"
      role="search"
      className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal"
    >
      <IconBuscar className="h-5 w-5 shrink-0 text-ink-muted" />
      <label htmlFor="explorador-busqueda" className="sr-only">
        Buscar por nombre del plato
      </label>
      {/*
        Búsqueda ampliada (viandera, etiqueta, barrio) queda como mejora
        posterior — `buscarPlatos` en lib/viandas/consultas.ts hoy solo
        hace ILIKE contra el nombre del plato. El label/placeholder no
        deben prometer más de lo que la consulta resuelve; las etiquetas
        siguen filtrándose mediante FilterChips, no por acá.
      */}
      <input
        id="explorador-busqueda"
        name="q"
        type="search"
        defaultValue={initialQuery}
        placeholder="Buscar por nombre del plato"
        maxLength={LARGO_MAXIMO_BUSQUEDA}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
      />
      {Object.entries(filtrosActuales).map(([clave, valor]) =>
        valor ? (
          <input key={clave} type="hidden" name={clave} value={valor} />
        ) : null,
      )}
      <button
        type="submit"
        className="min-h-[44px] rounded-full bg-coral-600 px-4 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
      >
        Buscar
      </button>
    </form>
  );
}
