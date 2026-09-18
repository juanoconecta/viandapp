import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioActualizarPassword from "@/components/auth/FormularioActualizarPassword";

export default async function ActualizarContrasenaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=recovery");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold text-ink">
        Elegí tu contraseña nueva
      </h1>

      <div className="mt-8">
        <FormularioActualizarPassword />
      </div>
    </div>
  );
}
