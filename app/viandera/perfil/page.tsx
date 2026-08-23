import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioPerfil from "@/components/viandera/FormularioPerfil";

export default async function PerfilVianderaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("nombre, bio, telefono, lat, lng")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viandera) redirect("/app");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-ink">Tu perfil</h1>
      <p className="mt-2 text-ink/60">Así te van a encontrar tus vecinos.</p>
      <div className="mt-8 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
        <FormularioPerfil
          nombreInicial={viandera.nombre}
          bioInicial={viandera.bio ?? ""}
          telefonoInicial={viandera.telefono ?? ""}
          latInicial={viandera.lat}
          lngInicial={viandera.lng}
        />
      </div>
    </div>
  );
}
