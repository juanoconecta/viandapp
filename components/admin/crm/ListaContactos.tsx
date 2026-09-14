import Link from "next/link";
import type { CrmContactoResumen, EstadoCrmContacto, TipoCrmContacto } from "@/types";
import { EstadoConsentimiento } from "./EstadoConsentimiento";

const ETIQUETA_TIPO: Record<TipoCrmContacto, string> = {
  cocina_potencial: "Cocina potencial",
  cocina_activa: "Cocina activa",
  consumidor: "Consumidor",
  aliado_estrategico: "Aliado estratégico",
  otro: "Otro",
};

const ETIQUETA_ESTADO: Record<EstadoCrmContacto, string> = {
  nuevo: "Nuevo",
  en_conversacion: "En conversación",
  calificado: "Calificado",
  activo: "Activo",
  inactivo: "Inactivo",
  descartado: "Descartado",
};

const TIPOS = Object.keys(ETIQUETA_TIPO) as TipoCrmContacto[];
const ESTADOS = Object.keys(ETIQUETA_ESTADO) as EstadoCrmContacto[];

const campoFiltroClase =
  "min-h-11 rounded-xl border border-ink/15 bg-paper px-3.5 py-2 text-sm text-ink transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

type Filtros = {
  busqueda: string;
  tipo: string;
  estado: string;
  consentimiento: string;
};

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ListaContactos({
  contactos,
  filtros,
}: {
  contactos: CrmContactoResumen[];
  filtros: Filtros;
}) {
  return (
    <div>
      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label htmlFor="crm-filtro-busqueda" className="text-sm font-medium text-ink/80">
            Buscar
          </label>
          <input
            id="crm-filtro-busqueda"
            name="busqueda"
            type="search"
            defaultValue={filtros.busqueda}
            placeholder="Nombre o contacto"
            className={campoFiltroClase}
          />
        </div>

        <div className="flex min-w-[160px] flex-col gap-1.5">
          <label htmlFor="crm-filtro-tipo" className="text-sm font-medium text-ink/80">
            Tipo
          </label>
          <select
            id="crm-filtro-tipo"
            name="tipo"
            defaultValue={filtros.tipo}
            className={campoFiltroClase}
          >
            <option value="">Todos</option>
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETA_TIPO[tipo]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[160px] flex-col gap-1.5">
          <label htmlFor="crm-filtro-estado" className="text-sm font-medium text-ink/80">
            Estado
          </label>
          <select
            id="crm-filtro-estado"
            name="estado"
            defaultValue={filtros.estado}
            className={campoFiltroClase}
          >
            <option value="">Todos</option>
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETA_ESTADO[estado]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[160px] flex-col gap-1.5">
          <label htmlFor="crm-filtro-consentimiento" className="text-sm font-medium text-ink/80">
            Consentimiento
          </label>
          <select
            id="crm-filtro-consentimiento"
            name="consentimiento"
            defaultValue={filtros.consentimiento}
            className={campoFiltroClase}
          >
            <option value="">Todos</option>
            <option value="vigente">Vigente</option>
            <option value="retirado">Retirado</option>
            <option value="anonimizado">Anonimizado</option>
          </select>
        </div>

        <div>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-coral px-6 text-sm font-medium text-white shadow-md shadow-coral/20 transition-all hover:-translate-y-0.5 hover:bg-coral-600 hover:shadow-lg"
          >
            Filtrar
          </button>
        </div>
      </form>

      {contactos.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          No encontramos contactos con estos filtros.
        </p>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-ink/10 bg-card md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Consentimiento</th>
                  <th className="px-4 py-3 font-medium">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {contactos.map((contacto) => (
                  <tr
                    key={contacto.id}
                    className="border-b border-ink/5 last:border-0 hover:bg-paper/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/crm/${contacto.id}`}
                        className="font-medium text-ink hover:text-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
                      >
                        {contacto.pii_eliminada
                          ? "Contacto anónimo"
                          : (contacto.nombre ?? "Sin nombre")}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink/60">
                      {contacto.pii_eliminada ? "—" : (contacto.contacto ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-ink/60">{ETIQUETA_TIPO[contacto.tipo]}</td>
                    <td className="px-4 py-3 text-ink/60">{ETIQUETA_ESTADO[contacto.estado]}</td>
                    <td className="px-4 py-3">
                      <EstadoConsentimiento
                        tipo={contacto.tipo}
                        piiEliminada={contacto.pii_eliminada}
                        consentimientoRetiradoEn={contacto.consentimiento_retirado_en}
                      />
                    </td>
                    <td className="px-4 py-3 text-ink/60">{fechaCorta(contacto.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:hidden">
            {contactos.map((contacto) => (
              <Link
                key={contacto.id}
                href={`/admin/crm/${contacto.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-card p-4 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold text-ink">
                      {contacto.pii_eliminada
                        ? "Contacto anónimo"
                        : (contacto.nombre ?? "Sin nombre")}
                    </p>
                    {!contacto.pii_eliminada && contacto.contacto && (
                      <p className="text-sm text-ink/60">{contacto.contacto}</p>
                    )}
                  </div>
                  <EstadoConsentimiento
                    tipo={contacto.tipo}
                    piiEliminada={contacto.pii_eliminada}
                    consentimientoRetiradoEn={contacto.consentimiento_retirado_en}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
                  <span>{ETIQUETA_TIPO[contacto.tipo]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ETIQUETA_ESTADO[contacto.estado]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fechaCorta(contacto.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
