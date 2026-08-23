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

  const { data: plato } = await supabase
    .from("viandas")
    .select("id, nombre, descripcion, precio, tipo, foto_url, disponible")
    .eq("id", id)
    .maybeSingle();

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
          }}
        />
      </div>
    </div>
  );
}
