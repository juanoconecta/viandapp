import FormularioInteres from "./FormularioInteres";

export default function CocinasFundadoras() {
  return (
    <section id="sumate" className="mx-auto w-full max-w-2xl scroll-mt-20 px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full bg-mostaza/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink">
          Cocina fundadora
        </span>
        <h2 className="font-display text-3xl font-bold text-ink">
          ¿Cocinás? Sé de las primeras en aparecer en ViandApp.
        </h2>
        <p className="max-w-md text-ink/70">
          Sin comisiones, sin depender de apps de delivery ni de
          publicar a mano en cada grupo de WhatsApp.
        </p>
      </div>
      <div className="mt-10">
        <FormularioInteres />
      </div>
    </section>
  );
}
