import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esAdmin } from "@/lib/auth/admin";
import { listarContactos, type FiltrosCrm } from "@/lib/crm/consultas";
import ListaContactos from "@/components/admin/crm/ListaContactos";
import FormularioContacto from "@/components/admin/crm/FormularioContacto";
import type { EstadoCrmContacto, TipoCrmContacto } from "@/types";

type BusquedaParams = {
  busqueda?: string;
  tipo?: string;
  estado?: string;
  consentimiento?: string;
};

const TIPOS_VALIDOS: readonly string[] = [
  "cocina_potencial",
  "cocina_activa",
  "consumidor",
  "aliado_estrategico",
  "otro",
];

const ESTADOS_VALIDOS: readonly string[] = [
  "nuevo",
  "en_conversacion",
  "calificado",
  "activo",
  "inactivo",
  "descartado",
];

const CONSENTIMIENTOS_VALIDOS: readonly string[] = ["vigente", "retirado", "anonimizado"];

const LARGO_MAXIMO_BUSQUEDA = 80;

type FiltrosParseados = {
  busqueda: string;
  tipo: TipoCrmContacto | undefined;
  estado: EstadoCrmContacto | undefined;
  consentimiento: FiltrosCrm["consentimiento"];
};

// Igual que `parsearFiltros` en lib/viandas/filtros.ts: un valor de
// query-string que no matchea el enum real cae a "sin filtro" en vez de
// viajar como cast forzado hasta la consulta a Supabase.
function parsearFiltrosCrm(params: BusquedaParams): FiltrosParseados {
  const busqueda = (params.busqueda ?? "").trim().slice(0, LARGO_MAXIMO_BUSQUEDA);

  const tipo = TIPOS_VALIDOS.includes(params.tipo ?? "")
    ? (params.tipo as TipoCrmContacto)
    : undefined;

  const estado = ESTADOS_VALIDOS.includes(params.estado ?? "")
    ? (params.estado as EstadoCrmContacto)
    : undefined;

  const consentimiento = CONSENTIMIENTOS_VALIDOS.includes(params.consentimiento ?? "")
    ? (params.consentimiento as FiltrosCrm["consentimiento"])
    : undefined;

  return { busqueda, tipo, estado, consentimiento };
}

export default async function AdminCrmPage({
  searchParams,
}: {
  searchParams: Promise<BusquedaParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esAdmin(user?.email)) {
    redirect("/app");
  }

  const params = await searchParams;
  const filtros = parsearFiltrosCrm(params);
  const contactos = await listarContactos(filtros);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">CRM</h1>
      <p className="mt-2 text-ink/60">
        Contactos, tareas e interacciones comerciales.
      </p>

      <details className="mt-6 rounded-2xl border border-ink/10 bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral">
          <span>Nuevo aliado u otro contacto</span>
          <span aria-hidden="true">+</span>
        </summary>
        <div className="px-4 pb-4">
          <FormularioContacto />
        </div>
      </details>

      <div className="mt-6">
        <ListaContactos
          contactos={contactos}
          filtros={{
            busqueda: filtros.busqueda,
            tipo: filtros.tipo ?? "",
            estado: filtros.estado ?? "",
            consentimiento: filtros.consentimiento ?? "",
          }}
        />
      </div>
    </div>
  );
}
