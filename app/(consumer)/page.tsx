import FormularioInteres from "@/components/landing/FormularioInteres";
import Reveal from "@/components/landing/Reveal";
import TarjetasVianda from "@/components/landing/TarjetasVianda";

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
    emoji: "💸",
    titulo: "Cero comisión",
    texto: "A diferencia de las apps de delivery, no te cobramos porcentaje por venta.",
    rotate: "-rotate-2",
  },
  {
    emoji: "📍",
    titulo: "Visibilidad en tu ciudad",
    texto: "Aparecés en el mapa para quienes buscan viandas en tu ciudad.",
    rotate: "rotate-1",
  },
  {
    emoji: "🎛️",
    titulo: "Vos ponés las reglas",
    texto: "Elegís tus precios, tus horarios y si hacés envíos o solo retiro.",
    rotate: "-rotate-1",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col overflow-x-clip">
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-8">
        <Reveal>
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-teal">
            Rafaela, Santa Fe
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
            Viandas caseras, directo a tu mesa.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink/70">
            Estamos armando una red de emprendimientos y comercios de Rafaela
            para que cualquiera pueda pedir comida casera, sin intermediarios
            ni apps que se quedan con la mitad de la venta.
          </p>
          <a
            href="#sumate"
            className="mt-8 inline-block rounded-full bg-coral px-7 py-3.5 text-base font-medium text-white shadow-lg shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-xl hover:shadow-coral/30 active:translate-y-0"
          >
            Quiero sumar mis viandas
          </a>
        </Reveal>

        <Reveal delay={0.15} className="hidden justify-self-center lg:block">
          <TarjetasVianda />
        </Reveal>
      </section>

      <section className="border-y border-ink/10 bg-card/60">
        <Reveal className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold text-ink">
            ¿De qué se trata?
          </h2>
          <p className="mx-auto text-ink/70">
            ViandApp es un espacio para que quienes cocinan viandas en
            Rafaela, tengan un lugar donde mostrarse y vender directo, sin
            depender de apps de delivery con comisiones altas ni de publicar
            a mano en cada grupo de WhatsApp. Estamos arrancando: primero
            sumamos &quot;vianderos&quot;, después abrimos el mapa para que
            la ciudad pida.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold text-ink">
            ¿Cómo funciona?
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {PASOS.map((paso, i) => (
            <Reveal key={paso.numero} delay={i * 0.1} className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-coral font-display text-lg font-bold text-white">
                {paso.numero}
              </div>
              <h3 className="font-display text-lg font-semibold text-ink">
                {paso.titulo}
              </h3>
              <p className="text-sm text-ink/65">{paso.texto}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-ink/10 bg-card/60">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <Reveal className="text-center">
            <h2 className="font-display text-3xl font-bold text-ink">
              ¿Por qué sumarte?
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {BENEFICIOS.map((beneficio, i) => (
              <Reveal key={beneficio.titulo} delay={i * 0.1}>
                <div
                  className={`h-full rounded-2xl border border-ink/10 bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:rotate-0 hover:shadow-md ${beneficio.rotate}`}
                >
                  <span className="text-2xl">{beneficio.emoji}</span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-teal">
                    {beneficio.titulo}
                  </h3>
                  <p className="mt-2 text-sm text-ink/65">{beneficio.texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="sumate" className="mx-auto w-full max-w-2xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal className="flex flex-col items-center gap-2 text-center">
          <h2 className="font-display text-3xl font-bold text-ink">
            ¿Hacés viandas? Anotate
          </h2>
          <p className="max-w-md text-ink/70">
            Dejanos tus datos y sé de las primeras en aparecer en ViandApp
            cuando abramos tu zona.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <FormularioInteres />
        </Reveal>
      </section>
    </div>
  );
}
