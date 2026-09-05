import Link from "next/link";
import ConfirmarPedido from "@/components/carrito/ConfirmarPedido";
import RevisarCambios from "@/components/carrito/RevisarCambios";
import { parsearCheckout } from "@/lib/carrito/checkout";
import { prepararCheckout } from "@/lib/carrito/checkoutServidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BusquedaParams = Record<string, string | string[] | undefined>;

function EstadoVacio({ mensaje = "No encontramos platos válidos en este pedido." }: { mensaje?: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-ink">Tu pedido está vacío</h1>
      <p className="mt-2 text-sm text-ink-muted">{mensaje}</p>
      <Link href="/explorar" className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-coral-600 px-6 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600">Explorar cocinas</Link>
    </div>
  );
}

export default async function PedidoPage({ searchParams }: { searchParams: Promise<BusquedaParams> }) {
  const parametros = await searchParams;
  const carrito = parsearCheckout(parametros.cocina, parametros.items);
  if (!carrito) return <EstadoVacio />;

  const supabase = await createClient();
  const { data: viandera, error: errorViandera } = await supabase
    .from("vianderas")
    .select("id, nombre, slug, activo, ofrece_retiro, ofrece_envio, costo_envio_propio")
    .eq("id", carrito.vianderaId)
    .eq("activo", true)
    .maybeSingle();

  if (errorViandera) {
    console.error("[pedido] fallo al consultar la cocina", errorViandera);
    throw new Error("No pudimos cargar este pedido.");
  }
  if (!viandera?.slug) return <EstadoVacio mensaje="La cocina ya no está disponible. Elegí otra opción." />;

  const { data: platos, error: errorPlatos } = await supabase
    .from("viandas")
    .select("id, vianderas_id, nombre, precio, disponible")
    .in("id", carrito.items.map((item) => item.platoId));
  if (errorPlatos) {
    console.error("[pedido] fallo al consultar los platos", errorPlatos);
    throw new Error("No pudimos cargar este pedido.");
  }

  const admin = createAdminClient();
  const { data: adhesion, error: errorAdhesion } = await admin
    .from("puni_adhesiones")
    .select("estado, costo_envio_puni")
    .eq("viandera_id", viandera.id)
    .eq("estado", "aprobada")
    .maybeSingle();
  if (errorAdhesion) {
    console.error("[pedido] fallo al consultar la adhesión a Puni", errorAdhesion);
    throw new Error("No pudimos cargar este pedido.");
  }
  const preparado = prepararCheckout(
    carrito,
    { ...viandera, slug: viandera.slug },
    platos ?? [],
    adhesion,
  );

  if (preparado.estado === "revisar") {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <RevisarCambios
          slug={preparado.slug}
          cambios={preparado.platosNoDisponibles.map((vianda_id) => ({ tipo: "plato_no_disponible" as const, vianda_id }))}
        />
      </div>
    );
  }

  return <ConfirmarPedido viandera={preparado.viandera} items={preparado.items} modalidades={preparado.modalidades} />;
}
