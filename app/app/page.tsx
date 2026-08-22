import { createClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-ink/10 bg-card p-10 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">
        ¡Bienvenido{user?.email ? `, ${user.email}` : ""}!
      </h1>
      <p className="text-ink/60">
        Ya estás adentro. Acá va a vivir la webapp de compras.
      </p>
    </div>
  );
}
