import FormularioRegistro from "@/components/auth/FormularioRegistro";

export default function RegistroPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold text-ink">
        Crear cuenta
      </h1>
      <p className="mt-2 text-center text-ink/60">
        Registrate para empezar a pedir tus viandas.
      </p>

      <div className="mt-8">
        <FormularioRegistro />
      </div>
    </div>
  );
}
