import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAdmin } from "@/lib/auth/admin";
import type { EstadoPedido, ModalidadPedido } from "@/types";

const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  generado: "Pendiente",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

const ETIQUETA_MODALIDAD: Record<ModalidadPedido, string> = {
  retiro: "Retiro",
  envio_propio: "Envío propio",
  envio_puni: "Envío por Puni",
};

const LIMITE_PEDIDOS = 100;

export default async function AdminPedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esAdmin(user?.email)) {
    redirect("/app");
  }

  const admin = createAdminClient();

  // Dos consultas separadas en vez de un select con embed
  // (`vianderas(nombre)`) — el `Database` de este proyecto está escrito a
  // mano con `Relationships: []` en cada tabla, así que un embed no tiene
  // metadata de relación para tipar bien el resultado. Mismo patrón que
  // `lib/viandas/consultas.ts` y `app/[slug]/page.tsx`.
  const { data: pedidos } = await admin
    .from("pedidos")
    .select("id, vianderas_id, modalidad, total, estado, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMITE_PEDIDOS);

  const idsVianderas = [...new Set((pedidos ?? []).map((pedido) => pedido.vianderas_id))];
  const { data: vianderas } =
    idsVianderas.length > 0
      ? await admin.from("vianderas").select("id, nombre").in("id", idsVianderas)
      : { data: [] };
  const nombres = new Map((vianderas ?? []).map((viandera) => [viandera.id, viandera.nombre]));

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Pedidos</h1>
      <p className="mt-2 text-ink/60">
        Lectura global de los últimos {LIMITE_PEDIDOS} pedidos. El cambio de
        estado lo hace cada cocina desde su propio panel.
      </p>

      {(pedidos ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">Todavía no hay pedidos.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-ink/10 bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
                <th className="px-4 py-3 font-medium">Cocina</th>
                <th className="px-4 py-3 font-medium">Modalidad</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(pedidos ?? []).map((pedido) => (
                <tr key={pedido.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 text-ink/80">
                    {nombres.get(pedido.vianderas_id) ?? "Cocina sin nombre"}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {ETIQUETA_MODALIDAD[pedido.modalidad] ?? pedido.modalidad}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    ${pedido.total.toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {ETIQUETA_ESTADO[pedido.estado] ?? pedido.estado}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {new Date(pedido.created_at).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
