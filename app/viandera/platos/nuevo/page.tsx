import FormularioPlato from "@/components/viandera/FormularioPlato";

export default function NuevoPlatoPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-ink">
        Nuevo plato
      </h1>
      <div className="mt-8 rounded-3xl border border-ink/10 bg-card p-6 shadow-sm sm:p-8">
        <FormularioPlato modo="nuevo" />
      </div>
    </div>
  );
}
