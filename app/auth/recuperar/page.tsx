import FormularioRecuperarPassword from "@/components/auth/FormularioRecuperarPassword";

export default function RecuperarPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold text-ink">
        Recuperar contraseña
      </h1>
      <p className="mt-2 text-center text-ink/60">
        Ingresá tu email y te mandamos un link para elegir una nueva.
      </p>

      <div className="mt-8">
        <FormularioRecuperarPassword />
      </div>
    </div>
  );
}
