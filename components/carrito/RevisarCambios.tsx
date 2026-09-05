import Link from "next/link";
import type { PedidoCambio } from "@/types";

const dinero = (valor: number) => `$${valor.toLocaleString("es-AR")}`;

export default function RevisarCambios({ slug, cambios, nombresPorId = {} }: { slug: string; cambios: PedidoCambio[]; nombresPorId?: Record<string, string> }) {
  function mensaje(cambio: PedidoCambio): string {
    if (cambio.tipo === "plato_no_disponible") return `${nombresPorId[cambio.vianda_id] ?? "Un plato"} ya no está disponible.`;
    if (cambio.tipo === "precio_cambio") return `${nombresPorId[cambio.vianda_id] ?? "Un plato"} ahora cuesta ${dinero(cambio.precio_actual)}.`;
    if (cambio.tipo === "modalidad_no_disponible") return "La modalidad elegida ya no está disponible.";
    return `El envío ahora cuesta ${dinero(cambio.costo_actual)}.`;
  }

  return (
    <section aria-labelledby="titulo-revisar" className="rounded-3xl border border-teal/30 bg-soft-teal p-5 text-ink">
      <h2 id="titulo-revisar" className="font-display text-xl font-bold">Revisá los cambios de tu pedido</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{cambios.map((cambio, indice) => <li key={indice}>{mensaje(cambio)}</li>)}</ul>
      <Link href={`/${slug}`} className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-teal px-5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">Volver a la cocina</Link>
    </section>
  );
}
