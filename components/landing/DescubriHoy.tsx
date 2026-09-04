import Link from "next/link";
import type { JSX } from "react";
import DishCard from "@/components/consumer/DishCard";
import { IconPlato } from "@/components/landing/icons";
import { buscarPlatos } from "@/lib/viandas/consultas";
import { clasificarDestacados } from "@/lib/viandas/destacados";

const CANTIDAD_DESTACADOS = 8;
const FILTROS_SIN_RESTRICCIONES = {
  q: "",
  tipo: "todos",
  etiqueta: null,
  modalidad: "todas",
} as const;

export default async function DescubriHoy(): Promise<JSX.Element> {
  // `buscarPlatos` no se atrapa acá directamente — `clasificarDestacados`
  // ya decide resultado/vacío/error de forma pura y testeada (Pasos
  // 1-4). A diferencia de `/explorar` (donde un error se deja
  // propagar a `error.tsx` porque la búsqueda es la página completa),
  // acá el error se convierte en un estado más porque esta sección es
  // una entre muchas — un fallo no puede tumbar el hero ni el
  // formulario de cocinas fundadoras.
  const resultado = await clasificarDestacados(
    () => buscarPlatos(FILTROS_SIN_RESTRICCIONES),
    CANTIDAD_DESTACADOS,
  );

  if (resultado.estado === "error") {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold text-ink">
          Descubrí qué hay para hoy
        </h2>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          No pudimos cargar los platos disponibles ahora mismo. Volvé a
          intentarlo en un rato. También podés probar en{" "}
          <Link href="/explorar" className="font-medium text-coral-600 underline-offset-2 hover:underline">
            /explorar
          </Link>
          , aunque puede tener el mismo problema por ahora.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <h2 className="font-display text-3xl font-bold text-ink">
        Descubrí qué hay para hoy
      </h2>
      <p className="mt-2 max-w-xl text-sm text-ink-muted">
        Los menús pueden cambiar — confirmá disponibilidad por WhatsApp
        antes de coordinar.
      </p>

      {resultado.estado === "vacio" ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-line bg-card px-6 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-soft-coral">
            <IconPlato className="h-5 w-5 text-coral" />
          </span>
          <p className="font-medium text-ink">
            Estamos sumando las primeras cocinas de Rafaela.
          </p>
          <p className="text-sm text-ink-muted">
            ¿Cocinás? Podés ser de las primeras en aparecer.
          </p>
          <Link
            href="/#sumate"
            className="mt-2 flex min-h-[44px] items-center rounded-full bg-coral-600 px-6 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
          >
            Sumar mi cocina
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resultado.platos.map((plato) => (
            <DishCard key={plato.id} plato={plato} />
          ))}
        </div>
      )}
    </section>
  );
}
