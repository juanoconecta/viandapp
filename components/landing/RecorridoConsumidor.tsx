const PASOS_CONSUMIDOR = [
  {
    numero: "1",
    titulo: "Explorá",
    texto: "Buscá por nombre de plato o filtrá por almuerzo, cena, retiro o envío.",
  },
  {
    numero: "2",
    titulo: "Elegí tu plato",
    texto: "Mirá el menú completo de cada cocina: fotos, precios y etiquetas dietarias.",
  },
  {
    numero: "3",
    titulo: "Coordiná por WhatsApp",
    texto: "Confirmás disponibilidad y entrega directo con la cocina, sin intermediarios.",
  },
] as const;

export default function RecorridoConsumidor() {
  return (
    <section id="como-funciona" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-14 sm:px-6">
      <h2 className="text-center font-display text-3xl font-bold text-ink">
        ¿Cómo funciona?
      </h2>
      <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
        {PASOS_CONSUMIDOR.map((paso) => (
          <div key={paso.numero} className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-coral font-display text-lg font-bold text-white">
              {paso.numero}
            </div>
            <h3 className="font-display text-lg font-semibold text-ink">
              {paso.titulo}
            </h3>
            <p className="text-sm text-ink/65">{paso.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
