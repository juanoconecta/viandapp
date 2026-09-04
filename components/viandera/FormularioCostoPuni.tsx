"use client";

import { useActionState } from "react";
import {
  actualizarCostoEnvioPuni,
  solicitarAdhesionPuni,
  type ResultadoActualizarCostoPuni,
  type ResultadoSolicitudAdhesion,
} from "@/app/viandera/actions";
import type { EstadoAdhesionVendedora } from "@/lib/envios/adhesionPropia";
import { campoClase } from "@/components/ui/campoClase";
import BotonEnviar from "@/components/ui/BotonEnviar";

type Props = { adhesion: EstadoAdhesionVendedora | null };

export default function FormularioCostoPuni({ adhesion }: Props) {
  const [solicitud, solicitar] = useActionState<ResultadoSolicitudAdhesion, FormData>(
    solicitarAdhesionPuni,
    { status: "idle" },
  );
  const [costo, guardarCosto] = useActionState<ResultadoActualizarCostoPuni, FormData>(
    actualizarCostoEnvioPuni,
    { status: "idle" },
  );

  const puedeSolicitar = !adhesion || adhesion.estado === "rechazada" || adhesion.estado === "revocada";

  return (
    <section aria-labelledby="puni-heading">
      <h2 id="puni-heading" className="font-display text-xl font-bold text-ink">
        Envío mediante Puni
      </h2>
      {!adhesion && <p className="mt-2 text-sm text-ink/65">Solicitá la adhesión para sumar esta modalidad.</p>}
      {adhesion?.estado === "pendiente" && <p className="mt-2 text-sm text-ink/65">Tu solicitud está en revisión.</p>}
      {adhesion?.estado === "suspendida" && <p className="mt-2 text-sm text-ink/65">Tu adhesión está suspendida temporalmente.</p>}
      {(adhesion?.estado === "rechazada" || adhesion?.estado === "revocada") && (
        <p className="mt-2 text-sm text-ink/65">
          La adhesión no está activa{adhesion.notaAdmin ? `: ${adhesion.notaAdmin}` : "."}
        </p>
      )}

      {puedeSolicitar && (
        <form action={solicitar} className="mt-4">
          {solicitud.status === "error" && <p role="alert" className="mb-3 text-sm text-coral-700">{solicitud.mensaje}</p>}
          <BotonEnviar label={adhesion ? "Volver a solicitar" : "Solicitar adhesión a Puni"} labelEnviando="Enviando..." />
        </form>
      )}

      {adhesion?.estado === "aprobada" && (
        <form action={guardarCosto} className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-teal-700">Adherida a Puni</p>
          <label htmlFor="costoEnvioPuni" className="text-sm font-medium text-ink/80">Costo que cobrás por el envío</label>
          <input
            id="costoEnvioPuni"
            name="costoEnvioPuni"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={adhesion.costoEnvioPuni ?? ""}
            className={campoClase}
          />
          <p className="text-xs text-ink/55">Sin costo cargado, esta modalidad no aparecerá en el carrito.</p>
          {costo.status === "error" && <p role="alert" className="text-sm text-coral-700">{costo.mensaje}</p>}
          {costo.status === "ok" && <p role="status" className="text-sm text-teal-700">Costo guardado.</p>}
          <div><BotonEnviar label="Guardar costo" labelEnviando="Guardando..." /></div>
        </form>
      )}
    </section>
  );
}
