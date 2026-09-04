import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAdmin } from "@/lib/auth/admin";
import FormularioInvitar from "@/components/admin/FormularioInvitar";
import TarjetaSolicitudPuni from "@/components/admin/TarjetaSolicitudPuni";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esAdmin(user?.email)) {
    redirect("/app");
  }

  const admin = createAdminClient();
  const { data: vianderas } = await admin
    .from("vianderas")
    .select("id, nombre, slug, user_id, created_at")
    .order("created_at", { ascending: false });
  const { data: adhesiones } = await admin
    .from("puni_adhesiones")
    .select("id, viandera_id, estado, solicitado_en, nota_admin");
  const nombres = new Map((vianderas ?? []).map((viandera) => [viandera.id, viandera.nombre]));
  const ordenEstado = { pendiente: 0, aprobada: 1, suspendida: 2, rechazada: 3, revocada: 4 } as const;
  const adhesionesOrdenadas = [...(adhesiones ?? [])].sort(
    (a, b) => ordenEstado[a.estado] - ordenEstado[b.estado],
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">
        Invitar vianderas
      </h1>
      <p className="mt-2 text-ink/60">
        Creá la ficha y mandale la invitación por email.
      </p>

      <div className="mt-8">
        <FormularioInvitar />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink">Solicitudes de adhesión a Puni</h2>
        <p className="mt-1 text-sm text-ink/60">Verificá y resolvé el estado. El costo lo configura cada viandera.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {adhesionesOrdenadas.map((adhesion) => (
            <TarjetaSolicitudPuni
              key={adhesion.id}
              id={adhesion.id}
              nombre={nombres.get(adhesion.viandera_id) ?? "Cocina sin nombre"}
              estado={adhesion.estado}
              solicitadoEn={adhesion.solicitado_en}
              notaAdmin={adhesion.nota_admin}
            />
          ))}
          {adhesionesOrdenadas.length === 0 && <p className="text-sm text-ink/50">No hay solicitudes todavía.</p>}
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
    </div>
  );
}
