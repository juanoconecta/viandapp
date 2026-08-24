import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioPlato from "@/components/viandera/FormularioPlato";

export default async function EditarPlatoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: plato } = await supabase
    .from("viandas")
    .select("id, nombre, descripcion, precio, tipo, foto_url, disponible, etiquetas")
    .eq("id", id)
    .eq("vianderas_id", viandera.id)
    .maybeSingle();

  // Scoping by vianderas_id (not just id) matters: "viandas" has a
  // permissive public SELECT policy (disponible = true) alongside the
  // owner-scoped one, and RLS combines permissive policies with OR — so
  // for the common case of a published dish, RLS alone would let any
  // logged-in viandera fetch someone else's plato here. The explicit
  // filter is what actually enforces "only your own dish, or redirect
  // exactly like a nonexistent one."
  if (!plato) redirect("/viandera");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-ink">
        Editar plato
      </h1>
      <div className="mt-8 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
        <FormularioPlato
          modo="editar"
          platoId={plato.id}
          valoresIniciales={{
            nombre: plato.nombre,
            descripcion: plato.descripcion ?? "",
            precio: plato.precio?.toString() ?? "",
            tipo: plato.tipo,
            fotoUrl: plato.foto_url,
            disponible: plato.disponible,
            etiquetas: plato.etiquetas,
          }}
        />
      </div>
    </div>
  );
}
