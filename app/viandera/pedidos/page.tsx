import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TarjetaPedido from "@/components/viandera/TarjetaPedido";
import type { Pedido, PedidoItem } from "@/types";

export default async function VianderaPedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viandera) redirect("/app");

  // Dos consultas separadas en vez de un select con embed
  // (`pedido_items(*)`) — el `Database` de este proyecto está escrito a
  // mano con `Relationships: []` en cada tabla, así que un embed no tiene
  // metadata de relación para tipar bien el resultado. Mismo patrón que
  // `lib/viandas/consultas.ts` y `app/[slug]/page.tsx`.
  const { data: pedidosCrudos } = await supabase
    .from("pedidos")
    .select("*")
    .eq("vianderas_id", viandera.id)
    .order("created_at", { ascending: false });

  const pedidos: (Pedido & { pedido_items: PedidoItem[] })[] = [];
  if (pedidosCrudos && pedidosCrudos.length > 0) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("*")
      .in("pedido_id", pedidosCrudos.map((pedido) => pedido.id));

    const itemsPorPedido = new Map<string, PedidoItem[]>();
    for (const item of items ?? []) {
      const lista = itemsPorPedido.get(item.pedido_id) ?? [];
      lista.push(item);
      itemsPorPedido.set(item.pedido_id, lista);
    }

    for (const pedido of pedidosCrudos) {
      pedidos.push({ ...pedido, pedido_items: itemsPorPedido.get(pedido.id) ?? [] });
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Pedidos</h1>

      {pedidos.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          Todavía no recibiste ningún pedido.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {pedidos.map((pedido) => (
            <TarjetaPedido key={pedido.id} pedido={pedido} />
          ))}
        </div>
      )}
    </div>
  );
}
