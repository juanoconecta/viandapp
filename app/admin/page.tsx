import { createAdminClient } from "@/lib/supabase/admin";
import FormularioInvitar from "@/components/admin/FormularioInvitar";

export default async function AdminPage() {
  const admin = createAdminClient();
  const { data: vianderas } = await admin
    .from("vianderas")
    .select("id, nombre, user_id, created_at")
    .order("created_at", { ascending: false });

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
        <h2 className="font-display text-lg font-semibold text-ink">
          Vianderas
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {(vianderas ?? []).map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-ink/10 bg-card px-4 py-3"
            >
              <span className="text-sm font-medium text-ink">{v.nombre}</span>
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
