import FormularioLogin from "@/components/auth/FormularioLogin";

// Solo permite rutas internas (un único "/" inicial) para evitar open
// redirects vía el query param `redirect` (ej. `//evil.com` es
// protocol-relative y redirect() lo trataría como externo).
function sanitizarRedirect(valor: string | undefined): string {
  if (valor && valor.startsWith("/") && !valor.startsWith("//")) {
    return valor;
  }
  return "/app";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = sanitizarRedirect(params.redirect);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold text-ink">
        Iniciar sesión
      </h1>
      <p className="mt-2 text-center text-ink/60">
        Entrá para pedir tus viandas.
      </p>

      {params.error === "oauth" && (
        <p className="mt-4 text-center text-sm text-coral-700">
          No pudimos completar el login con Google. Probá de nuevo.
        </p>
      )}

      <div className="mt-8">
        <FormularioLogin redirectTo={redirectTo} />
      </div>
    </div>
  );
}
