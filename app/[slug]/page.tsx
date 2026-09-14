import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarSlug } from "@/lib/viandera/slug";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import PublicDishCard, {
  type PlatoStorefront,
} from "@/components/storefront/PublicDishCard";
import { CarritoProvider } from "@/components/carrito/CarritoProvider";
import CajonCarrito from "@/components/carrito/CajonCarrito";
import { adhesionesAprobadas } from "@/lib/envios/adhesionPublica";

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
    description:
      viandera.bio || `Viandas caseras de ${viandera.nombre} en Rafaela.`,
    alternates: { canonical: `/${slugNormalizado}` },
  };
}

export default async function VianderaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugNormalizado = normalizarSlug(slug);
  const supabase = await createClient();

  const { data: viandera, error: errorViandera } = await supabase
    .from("vianderas")
    .select(
      "id, nombre, bio, telefono, barrio, ofrece_retiro, ofrece_envio, costo_envio_propio, updated_at, activo",
    )
    .eq("slug", slugNormalizado)
    .maybeSingle();

  // Un error real de consulta nunca debe leerse como "este perfil no
  // existe" — se loguea completo en servidor y se relanza sanitizado, para
  // que `app/[slug]/error.tsx` lo capture. `notFound()` queda reservado
  // para el caso legítimo: la fila no existe o está inactiva.
  if (errorViandera) {
    console.error("[perfil] fallo al consultar la viandera", errorViandera);
    throw new Error("No pudimos cargar este perfil.");
  }

  if (!viandera || !viandera.activo) {
    notFound();
  }
  const adhesionPuni = (await adhesionesAprobadas([viandera.id])).has(viandera.id);

  const { data: platosCrudos, error: errorPlatos } = await supabase
    .from("viandas")
    .select("id, nombre, descripcion, precio, tipo, foto_url, etiquetas")
    .eq("vianderas_id", viandera.id)
    .eq("disponible", true)
    .order("created_at", { ascending: false });

  if (errorPlatos) {
    console.error("[perfil] fallo al consultar los platos", errorPlatos);
    throw new Error("No pudimos cargar este perfil.");
  }

  const platos: PlatoStorefront[] = (platosCrudos ?? []).map((plato) => ({
    id: plato.id,
    nombre: plato.nombre,
    descripcion: plato.descripcion,
    precio: plato.precio,
    tipo: plato.tipo,
    fotoUrl: plato.foto_url,
    etiquetas: plato.etiquetas,
  }));

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <CarritoProvider>
        <div className="rounded-3xl shadow-lg shadow-ink/5">
          <div className="overflow-hidden rounded-3xl border border-ink/10 bg-card">
            <StorefrontHeader
              nombre={viandera.nombre}
              bio={viandera.bio}
              barrio={viandera.barrio}
              ofreceRetiro={viandera.ofrece_retiro}
              ofreceEnvio={viandera.ofrece_envio}
              actualizadoEn={viandera.updated_at}
              adheridaAPuni={adhesionPuni}
            />

            {platos.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">
                Está preparando su próximo menú.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {platos.map((plato) => (
                  <PublicDishCard
                    key={plato.id}
                    vianderaId={viandera.id}
                    plato={plato}
                  />
                ))}
              </ul>
            )}
          </div>
          <CajonCarrito
            vianderaId={viandera.id}
            nombreViandera={viandera.nombre}
            platos={platos.map((plato) => ({ id: plato.id, nombre: plato.nombre, precio: plato.precio }))}
          />
        </div>
      </CarritoProvider>
    </div>
  );
}
