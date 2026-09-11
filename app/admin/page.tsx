import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAdmin } from "@/lib/auth/admin";
import { obtenerResumenAdmin } from "@/lib/crm/consultas";
import FormularioInvitar from "@/components/admin/FormularioInvitar";
import BotonPurgarPedidos from "@/components/admin/BotonPurgarPedidos";

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function haceSieteDias(): string {
  return new Date(Date.now() - SIETE_DIAS_MS).toISOString();
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esAdmin(user?.email)) {
    redirect("/app");
  }

  const admin = createAdminClient();

  const [resumen, { count: pedidosRecientes }, { count: puniPendientes }, { data: vianderas }] =
    await Promise.all([
      obtenerResumenAdmin(),
      admin
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .gte("created_at", haceSieteDias()),
      admin
        .from("puni_adhesiones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente"),
      admin
        .from("vianderas")
        .select("id, nombre, slug, user_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const tarjetas = [
    {
      href: "/admin/crm?estado=nuevo",
      valor: resumen.contactosNuevos,
      etiqueta: "Contactos nuevos",
    },
    {
      href: "/admin/crm",
      valor: resumen.tareasVencidas,
      etiqueta: "Tareas vencidas",
    },
    {
      href: "/admin/pedidos",
      valor: pedidosRecientes ?? 0,
      etiqueta: "Pedidos (últimos 7 días)",
    },
    {
      href: "/admin/puni",
      valor: puniPendientes ?? 0,
      etiqueta: "Solicitudes Puni pendientes",
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <Link
            key={tarjeta.href}
            href={tarjeta.href}
            className="rounded-2xl border border-ink/10 bg-card p-4 transition-colors hover:border-coral/40"
          >
            <p className="font-display text-2xl font-bold text-ink">{tarjeta.valor}</p>
            <p className="mt-1 text-sm text-ink/60">{tarjeta.etiqueta}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">
          Alta de cocina
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Creá la ficha y mandale la invitación por email.
        </p>
        <div className="mt-4">
          <FormularioInvitar />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">
          Vianderas
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {(vianderas ?? []).map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-ink/10 bg-card px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink">{v.nombre}</span>
                {v.slug && (
                  <span className="text-xs text-ink/50">viandapp.ar/{v.slug}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  v.user_id ? "text-teal-700" : "text-ink/40"
                }`}
              >
                {v.user_id ? "Cuenta activa" : "Invitada, pendiente"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">Mantenimiento</h2>
        <p className="mt-1 text-sm text-ink/60">
          El cron diario ya purga pedidos vencidos automáticamente — usá esto solo si necesitás forzarlo.
        </p>
        <div className="mt-4">
          <BotonPurgarPedidos />
        </div>
      </div>
    </div>
  );
}
