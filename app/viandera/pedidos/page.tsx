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

  // El `Database` de este proyecto está escrito a mano con `Relationships: []`
  // en cada tabla (ver lib/viandas/consultas.ts), así que un embed
  // `pedido_items(*)` no tiene metadata de relación para tipar el resultado
  // automáticamente — se castea explícitamente a la forma real que devuelve
  // esta consulta.
  const { data: pedidosCrudos } = await supabase
    .from("pedidos")
    .select("*, pedido_items(*)")
    .eq("vianderas_id", viandera.id)
    .order("created_at", { ascending: false });

  const pedidos = pedidosCrudos as unknown as
    | (Pedido & { pedido_items: PedidoItem[] })[]
    | null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Pedidos</h1>

      {(pedidos ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          Todavía no recibiste ningún pedido.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {(pedidos ?? []).map((pedido) => (
            <TarjetaPedido key={pedido.id} pedido={pedido} />
          ))}
        </div>
      )}
    </div>
  );
}
