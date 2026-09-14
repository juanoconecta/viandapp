"use client";

import { useActionState } from "react";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { EstadoConsentimiento } from "./EstadoConsentimiento";
import FormularioNota from "./FormularioNota";
import FormularioTarea from "./FormularioTarea";
import FormularioInteraccion from "./FormularioInteraccion";
import {
  actualizarEstadoContacto,
  anonimizarContacto,
  completarTarea,
  retirarConsentimiento,
  type ResultadoAccion,
} from "@/app/admin/crm/actions";
import type { DetalleContacto as DetalleContactoData } from "@/lib/crm/consultas";
import type {
  EstadoCrmContacto,
  EstadoPedido,
  ModalidadPedido,
  TipoCrmContacto,
} from "@/types";

const ESTADO_INICIAL: ResultadoAccion = { status: "idle" };

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

const ESTADOS_CONTACTO = Object.keys(ETIQUETA_ESTADO) as EstadoCrmContacto[];

const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  generado: "Pendiente",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

const ETIQUETA_MODALIDAD_PEDIDO: Record<ModalidadPedido, string> = {
  retiro: "Retiro",
  envio_propio: "Envío propio",
  envio_puni: "Envío por Puni",
};

const campoClase =
  "min-h-11 rounded-xl border border-ink/15 bg-paper px-3.5 py-2 text-sm text-ink transition-colors focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/25";

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// vence_en es una fecha sin hora (viene de un <input type="date">) guardada
// como medianoche UTC. Formatearla con la zona horaria local (como hace
// fechaCorta) la corre un día para atrás en cualquier huso horario negativo
// -- por eso acá se formatea en UTC y sin hora, que es lo único que el
// formulario realmente capturó.
function fechaSoloDia(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SelectorEstado({
  contactoId,
  estadoActual,
}: {
  contactoId: string;
  estadoActual: EstadoCrmContacto;
}) {
  const [estado, formAction] = useActionState(actualizarEstadoContacto, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="contactoId" value={contactoId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crm-detalle-estado" className="text-sm font-medium text-ink/80">
          Estado
        </label>
        <select
          id="crm-detalle-estado"
          name="estado"
          defaultValue={estadoActual}
          className={campoClase}
        >
          {ESTADOS_CONTACTO.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_ESTADO[valor]}
            </option>
          ))}
        </select>
      </div>
      <BotonEnviar label="Guardar estado" labelEnviando="Guardando..." />
      {estado.status === "error" && (
        <p className="w-full text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}

function BotonRetirarConsentimiento({ contactoId }: { contactoId: string }) {
  const [estado, formAction] = useActionState(retirarConsentimiento, ESTADO_INICIAL);

  return (
    <form
      action={formAction}
      onSubmit={(evento) => {
        if (!window.confirm("¿Retirar el consentimiento de este contacto?")) {
          evento.preventDefault();
        }
      }}
      className="flex flex-col items-start gap-2"
    >
      <input type="hidden" name="contactoId" value={contactoId} />
      <button
        type="submit"
        className="min-h-11 rounded-xl border border-ink/15 px-4 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5"
      >
        Retirar consentimiento
      </button>
      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Consentimiento retirado.
        </p>
      )}
    </form>
  );
}

function BotonAnonimizar({ contactoId }: { contactoId: string }) {
  const [estado, formAction] = useActionState(anonimizarContacto, ESTADO_INICIAL);

  return (
    <form
      action={formAction}
      onSubmit={(evento) => {
        if (
          !window.confirm(
            "¿Anonimizar este contacto? Esta acción no se puede deshacer.",
          )
        ) {
          evento.preventDefault();
        }
      }}
      className="flex flex-col items-start gap-2"
    >
      <input type="hidden" name="contactoId" value={contactoId} />
      <button
        type="submit"
        className="min-h-11 rounded-xl border border-coral/30 px-4 text-sm font-medium text-coral-700 transition-colors hover:bg-soft-coral"
      >
        Anonimizar contacto
      </button>
      {estado.status === "error" && (
        <p className="text-sm text-coral-700" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.status === "ok" && (
        <p className="text-sm text-teal-700" role="status">
          Contacto anonimizado.
        </p>
      )}
    </form>
  );
}

function BotonCompletarTarea({ tareaId }: { tareaId: string }) {
  const [estado, formAction] = useActionState(completarTarea, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tareaId" value={tareaId} />
      <button
        type="submit"
        className="min-h-11 rounded-full bg-teal-100 px-3 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-200"
      >
        Completar
      </button>
      {estado.status === "error" && (
        <span className="text-xs text-coral-700" role="alert">
          {estado.mensaje}
        </span>
      )}
    </form>
  );
}

export default function DetalleContacto({ detalle }: { detalle: DetalleContactoData }) {
  const { contacto, notas, tareas, interacciones, pedidos } = detalle;
  const esConsumidor = contacto.tipo === "consumidor";
  const identidad = contacto.pii_eliminada
    ? "Contacto anónimo"
    : (contacto.nombre ?? "Sin nombre");

  return (
    <div className="flex flex-col gap-8">
      <header className="rounded-2xl border border-ink/10 bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{identidad}</h1>
            {!contacto.pii_eliminada && contacto.contacto && (
              <p className="mt-1 text-sm text-ink/60">{contacto.contacto}</p>
            )}
            <p className="mt-2 text-xs uppercase tracking-wide text-ink/40">
              {ETIQUETA_TIPO[contacto.tipo]} · Fuente: {contacto.fuente}
            </p>
          </div>
          <EstadoConsentimiento
            tipo={contacto.tipo}
            piiEliminada={contacto.pii_eliminada}
            consentimientoRetiradoEn={contacto.consentimiento_retirado_en}
          />
        </div>

        {contacto.etiquetas.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {contacto.etiquetas.map((etiqueta) => (
              <span
                key={etiqueta}
                className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-ink/60"
              >
                {etiqueta}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6">
          <SelectorEstado contactoId={contacto.id} estadoActual={contacto.estado} />
        </div>

        {esConsumidor && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-ink/10 pt-6">
            <BotonRetirarConsentimiento contactoId={contacto.id} />
            <BotonAnonimizar contactoId={contacto.id} />
          </div>
        )}
      </header>

      <section aria-labelledby="crm-notas">
        <h2 id="crm-notas" className="font-display text-lg font-semibold text-ink">
          Notas
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {notas.map((nota) => (
            <div
              key={nota.id}
              className="rounded-xl border border-ink/10 bg-card p-4 text-sm text-ink/80"
            >
              <p>{nota.texto}</p>
              <p className="mt-2 text-xs text-ink/40">{fechaCorta(nota.created_at)}</p>
            </div>
          ))}
          {notas.length === 0 && <p className="text-sm text-ink/50">Todavía no hay notas.</p>}
        </div>
        <div className="mt-4">
          <FormularioNota contactoId={contacto.id} />
        </div>
      </section>

      <section aria-labelledby="crm-tareas">
        <h2 id="crm-tareas" className="font-display text-lg font-semibold text-ink">
          Tareas
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {tareas.map((tarea) => (
            <div
              key={tarea.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-card p-4"
            >
              <div>
                <p
                  className={`text-sm ${tarea.completada ? "text-ink/40 line-through" : "text-ink/80"}`}
                >
                  {tarea.titulo}
                </p>
                {tarea.vence_en && (
                  <p className="mt-1 text-xs text-ink/40">
                    Vence: {fechaSoloDia(tarea.vence_en)}
                  </p>
                )}
              </div>
              {!tarea.completada && <BotonCompletarTarea tareaId={tarea.id} />}
            </div>
          ))}
          {tareas.length === 0 && (
            <p className="text-sm text-ink/50">Todavía no hay tareas.</p>
          )}
        </div>
        <div className="mt-4">
          <FormularioTarea contactoId={contacto.id} />
        </div>
      </section>

      <section aria-labelledby="crm-interacciones">
        <h2 id="crm-interacciones" className="font-display text-lg font-semibold text-ink">
          Interacciones
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {interacciones.map((interaccion) => (
            <div
              key={interaccion.id}
              className="rounded-xl border border-ink/10 bg-card p-4 text-sm text-ink/80"
            >
              <p className="text-xs uppercase tracking-wide text-ink/40">
                {interaccion.tipo}
              </p>
              <p className="mt-1">{interaccion.resumen}</p>
              <p className="mt-2 text-xs text-ink/40">
                {fechaCorta(interaccion.created_at)}
              </p>
            </div>
          ))}
          {interacciones.length === 0 && (
            <p className="text-sm text-ink/50">Todavía no hay interacciones.</p>
          )}
        </div>
        <div className="mt-4">
          <FormularioInteraccion contactoId={contacto.id} />
        </div>
      </section>

      <section aria-labelledby="crm-pedidos">
        <h2 id="crm-pedidos" className="font-display text-lg font-semibold text-ink">
          Pedidos vinculados
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-card px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs text-ink/30">
                {pedido.id.slice(0, 8)}
              </span>
              <span className="text-ink/60">{ETIQUETA_MODALIDAD_PEDIDO[pedido.modalidad]}</span>
              <span className="font-medium text-ink">
                ${pedido.total.toLocaleString("es-AR")}
              </span>
              <span className="text-ink/60">{ETIQUETA_ESTADO_PEDIDO[pedido.estado]}</span>
              <span className="text-ink/40">{fechaCorta(pedido.created_at)}</span>
            </div>
          ))}
          {pedidos.length === 0 && (
            <p className="text-sm text-ink/50">Sin pedidos vinculados.</p>
          )}
        </div>
      </section>
    </div>
  );
}
