import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETAS_DIETARIAS } from "@/lib/viandera/etiquetas";
import { normalizarSlug } from "@/lib/viandera/slug";

const TIPO_ETIQUETA: Record<string, string> = {
  almuerzo: "Almuerzo",
  cena: "Cena",
  ambos: "Almuerzo y cena",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const slugNormalizado = normalizarSlug(slug);

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("nombre, bio, activo")
    .eq("slug", slugNormalizado)
    .maybeSingle();

  if (!viandera || !viandera.activo) {
    return { title: "ViandApp" };
  }

  return {
    title: `${viandera.nombre} — ViandApp`,
    description: viandera.bio || `Viandas caseras de ${viandera.nombre} en Rafaela.`,
    alternates: { canonical: `/${slugNormalizado}` },
  };
}

export default async function VianderaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: viandera } = await supabase
    .from("vianderas")
    .select("id, nombre, bio, telefono, activo")
    .eq("slug", normalizarSlug(slug))
    .maybeSingle();

  if (!viandera || !viandera.activo) {
    notFound();
  }

  const { data: platos } = await supabase
    .from("viandas")
    .select("id, nombre, descripcion, precio, tipo, foto_url, etiquetas")
    .eq("vianderas_id", viandera.id)
    .eq("disponible", true)
    .order("created_at", { ascending: false });

  const iniciales = viandera.nombre
    .split(" ")
    .map((palabra) => palabra[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const whatsappHref = viandera.telefono
    ? `https://wa.me/${viandera.telefono.replace(/\D/g, "")}`
    : null;

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-ink/10 bg-card shadow-lg shadow-ink/5">
        <div className="flex items-center gap-3 border-b border-ink/10 bg-teal px-5 py-4 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 font-display text-lg font-bold">
            {iniciales}
          </div>
          <div className="flex-1">
            <h1 className="font-display font-semibold leading-tight">
              {viandera.nombre}
            </h1>
            {viandera.bio && (
              <p className="text-xs text-white/75">{viandera.bio}</p>
            )}
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            Activa
          </span>
        </div>

        {(platos ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink/60">
            Todavía no hay platos cargados.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {(platos ?? []).map((plato) => (
              <li key={plato.id} className="flex gap-3 px-5 py-3.5">
                {plato.foto_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={plato.foto_url}
                    alt={plato.nombre}
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="flex flex-1 items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {plato.nombre}
                    </p>
                    {plato.descripcion && (
                      <p className="mt-0.5 text-xs text-ink/60">
                        {plato.descripcion}
                      </p>
                    )}
                    <p className="text-xs text-ink/50">
                      {TIPO_ETIQUETA[plato.tipo] ?? plato.tipo}
                    </p>
                    {plato.etiquetas.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {plato.etiquetas.map((valor) => {
                          const et = ETIQUETAS_DIETARIAS.find(
                            (e) => e.valor === valor,
                          );
                          return et ? (
                            <span
                              key={valor}
                              className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700"
                            >
                              {et.etiqueta}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  {plato.precio != null && (
                    <p className="whitespace-nowrap font-display text-sm font-semibold text-coral">
                      ${plato.precio.toLocaleString("es-AR")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {whatsappHref && (
          <div className="border-t border-ink/10 bg-paper/60 px-5 py-4">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-full bg-coral px-6 py-3 text-center text-sm font-medium text-white shadow-sm transition-all hover:bg-coral-600 hover:shadow-md active:scale-95"
            >
              Pedir por WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
