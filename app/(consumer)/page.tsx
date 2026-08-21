import FormularioInteres from "@/components/landing/FormularioInteres";
import PreviewPerfil from "@/components/landing/PreviewPerfil";
import Reveal from "@/components/landing/Reveal";
import TarjetasVianda from "@/components/landing/TarjetasVianda";
import { IconMoneda, IconPin, IconControles } from "@/components/landing/icons";

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
    Icon: IconMoneda,
    titulo: "Cero comisión",
    texto: "A diferencia de las apps de delivery, no te cobramos porcentaje por venta.",
  },
  {
    Icon: IconPin,
    titulo: "Visibilidad en tu ciudad",
    texto: "Aparecés en el mapa para quienes buscan viandas en tu ciudad.",
  },
  {
    Icon: IconControles,
    titulo: "Vos ponés las reglas",
    texto: "Elegís tus precios, tus horarios y si hacés envíos o solo retiro.",
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
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-ink">
              Así se va a ver tu perfil
            </h2>
            <p className="mt-3 text-ink/70">
              Cada viandero tiene su propia página: tus platos, tus precios y
              un botón directo a tu WhatsApp. Nada de formularios eternos ni
              intermediarios en el medio del pedido.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <PreviewPerfil />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-bold text-ink">
            ¿Por qué sumarte?
          </h2>
        </Reveal>
        <div className="mt-10 flex flex-col divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-card">
          {BENEFICIOS.map((beneficio, i) => (
            <Reveal key={beneficio.titulo} delay={i * 0.08}>
              <div className="flex items-center gap-5 px-6 py-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal/10">
                  <beneficio.Icon className="h-5 w-5 text-teal" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-ink">
                    {beneficio.titulo}
                  </h3>
                  <p className="mt-0.5 text-sm text-ink/65">{beneficio.texto}</p>
                </div>
              </div>
            </Reveal>
          ))}
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
