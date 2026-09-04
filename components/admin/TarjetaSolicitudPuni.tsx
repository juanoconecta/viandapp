"use client";

import { useActionState } from "react";
import {
  resolverAdhesionPuni,
  type ResultadoResolverAdhesion,
} from "@/app/admin/actions";
import { transicionValida, type EstadoAdhesionPuni } from "@/lib/envios/transiciones";

type Props = {
  id: string;
  nombre: string;
  estado: EstadoAdhesionPuni;
  solicitadoEn: string;
  notaAdmin: string | null;
};

const ETIQUETA_ESTADO: Record<EstadoAdhesionPuni, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  suspendida: "Suspendida",
  revocada: "Revocada",
};

export default function TarjetaSolicitudPuni({ id, nombre, estado, solicitadoEn, notaAdmin }: Props) {
  const [resultado, action] = useActionState<ResultadoResolverAdhesion, FormData>(
    resolverAdhesionPuni,
    { status: "idle" },
  );
  const acciones = (["aprobada", "rechazada", "suspendida", "revocada"] as EstadoAdhesionPuni[])
    .filter((siguiente) => transicionValida(estado, siguiente, "admin"));

  return (
    <article className="rounded-2xl border border-ink/10 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-ink">{nombre}</h3>
          <p className="mt-1 text-xs text-ink/50">
            Solicitada el {new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(solicitadoEn))}
          </p>
        </div>
        <span className="rounded-full bg-soft-teal px-2.5 py-1 text-xs font-semibold text-teal-700">
          {ETIQUETA_ESTADO[estado]}
        </span>
      </div>
      {notaAdmin && <p className="mt-3 text-sm text-ink/65">Nota: {notaAdmin}</p>}
      {acciones.length > 0 && (
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="adhesionId" value={id} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink/80">
            Nota administrativa (opcional)
            <textarea name="notaAdmin" rows={2} maxLength={500} className="rounded-xl border border-ink/15 bg-paper px-3.5 py-3 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/25" />
          </label>
          {resultado.status === "error" && <p role="alert" className="text-sm text-coral-700">{resultado.mensaje}</p>}
          <div className="flex flex-wrap gap-2">
            {acciones.map((siguiente) => (
              <button
                key={siguiente}
                type="submit"
                name="estado"
                value={siguiente}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${siguiente === "aprobada" ? "bg-teal text-white" : "border border-ink/15 text-ink"}`}
              >
                {siguiente === "aprobada" ? "Aprobar" : ETIQUETA_ESTADO[siguiente]}
              </button>
            ))}
          </div>
        </form>
      )}
    </article>
  );
}
