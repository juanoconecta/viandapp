import { IconMoneda, IconPin, IconPlato } from "./icons";

const ITEMS_VALOR = [
  { Icon: IconPlato, texto: "Directo a la cocina" },
  { Icon: IconMoneda, texto: "Sin comisiones" },
  { Icon: IconPin, texto: "Hecho en Rafaela" },
] as const;

export default function FranjaValor() {
  return (
    <section className="bg-soft-teal">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-center sm:gap-12 sm:px-6">
        {ITEMS_VALOR.map(({ Icon, texto }) => (
          <div key={texto} className="flex items-center gap-3">
            <Icon className="h-6 w-6 shrink-0 text-teal" />
            <span className="font-display text-base font-semibold text-ink">
              {texto}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
