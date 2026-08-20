import FormularioInteres from "@/components/landing/FormularioInteres";

const PASOS = [
  {
    numero: "1",
    titulo: "Te anotás",
    texto: "Completás el formulario contándonos qué cocinás y en qué zona de Rafaela estás.",
  },
  {
    numero: "2",
    titulo: "Armamos tu perfil",
    texto: "Te ayudamos a subir tus viandas, precios y días de entrega a la plataforma.",
  },
  {
    numero: "3",
    titulo: "Vendés sin intermediarios",
    texto: "Tus vecinos te encuentran directo en el mapa y te piden a vos, sin comisiones de por medio.",
  },
];

const BENEFICIOS = [
  {
    titulo: "Cero comisión",
    texto: "A diferencia de las apps de delivery, no te cobramos porcentaje por venta.",
  },
  {
    titulo: "Visibilidad en tu barrio",
    texto: "Aparecés en el mapa para los vecinos que buscan comida casera cerca suyo.",
  },
  {
    titulo: "Vos ponés las reglas",
    texto: "Elegís tus precios, tus horarios y si hacés envíos o solo retiro.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
        <h1 className="text-4xl font-medium text-neutral-900 sm:text-5xl">
          Viandas caseras, directo de tu vecina a tu mesa
        </h1>
        <p className="max-w-2xl text-lg text-neutral-500">
          Estamos armando una red de vianderas de Rafaela para que cualquiera pueda
          pedir comida casera cerca de casa, sin intermediarios ni apps que se
          quedan con la mitad de la venta.
        </p>
        <a
          href="#sumate"
          className="mt-2 rounded-full bg-coral px-6 py-3 text-sm font-medium text-white hover:bg-coral-600"
        >
          Quiero sumar mis viandas
        </a>
      </section>

      <section className="border-t border-black/5 bg-neutral-50">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-medium text-neutral-900">¿De qué se trata?</h2>
          <p className="mx-auto max-w-2xl text-neutral-600">
            ViandApp es un espacio para que las vianderas de Rafaela —esas cocineras
            de barrio que hacen comida casera para vender— tengan un lugar donde
            mostrarse y vender directo, sin depender de apps de delivery con
            comisiones altas ni de publicar a mano en cada grupo de WhatsApp.
            Estamos arrancando: primero sumamos vianderas, después abrimos el mapa
            para que los vecinos pidan.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-medium text-neutral-900">
          ¿Cómo funciona?
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {PASOS.map((paso) => (
            <div key={paso.numero} className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-coral text-sm font-medium text-white">
                {paso.numero}
              </div>
              <h3 className="font-medium text-neutral-900">{paso.titulo}</h3>
              <p className="text-sm text-neutral-500">{paso.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-black/5 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-medium text-neutral-900">
            ¿Por qué sumarte?
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {BENEFICIOS.map((beneficio) => (
              <div key={beneficio.titulo} className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="font-medium text-teal">{beneficio.titulo}</h3>
                <p className="mt-2 text-sm text-neutral-500">{beneficio.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="sumate" className="mx-auto w-full max-w-2xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-medium text-neutral-900">
            ¿Hacés viandas? Anotate
          </h2>
          <p className="max-w-md text-neutral-500">
            Dejanos tus datos y sé de las primeras en aparecer en ViandApp cuando
            abramos tu zona.
          </p>
        </div>
        <div className="mt-8">
          <FormularioInteres />
        </div>
      </section>
    </div>
  );
}
