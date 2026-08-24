import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TarjetaPlato from "@/components/viandera/TarjetaPlato";

export default async function VianderaDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id, nombre, activo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viandera) redirect("/app");

  const { data: platos } = await supabase
    .from("viandas")
    .select("id, nombre, precio, tipo, foto_url, disponible, etiquetas")
    .eq("vianderas_id", viandera.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-ink">
          {viandera.nombre}
        </h1>
        <p className="text-sm text-ink/60">
          {viandera.activo ? "Perfil activo" : "Perfil inactivo"}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">
          Tus platos
        </h2>
        <Link
          href="/viandera/platos/nuevo"
          className="rounded-full bg-coral px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-coral-600 hover:shadow-md active:scale-95"
        >
          + Agregar plato
        </Link>
      </div>

      {(platos ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          Todavía no cargaste ningún plato.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(platos ?? []).map((plato) => (
            <TarjetaPlato key={plato.id} plato={plato} />
          ))}
        </div>
      )}
    </div>
  );
}
