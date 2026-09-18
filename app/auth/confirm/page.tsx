import FormularioConfirmarRecuperacion from "@/components/auth/FormularioConfirmarRecuperacion";

export default async function ConfirmarRecuperacionPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash ?? "";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold text-ink">
        Confirmá para continuar
      </h1>
      <p className="mt-2 text-center text-ink/60">
        Por seguridad, confirmá con un click antes de elegir tu contraseña nueva.
      </p>

      <div className="mt-8">
        {tokenHash ? (
          <FormularioConfirmarRecuperacion
            tokenHash={tokenHash}
            redirectTo={params.redirect ?? "/auth/actualizar-contrasena"}
          />
        ) : (
          <p className="text-center text-sm text-coral-700">
            Este link de recuperación no es válido.
          </p>
        )}
      </div>
    </div>
  );
}
