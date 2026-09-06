"use client";

import { actualizarEstadoPedido } from "@/app/viandera/actions";
import type { EstadoPedido, ModalidadPedido, Pedido, PedidoItem } from "@/types";

const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  generado: "Pendiente",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

const ESTILO_ESTADO: Record<EstadoPedido, string> = {
  generado: "bg-ink/10 text-ink/50",
  confirmado: "bg-teal-100 text-teal-700",
  rechazado: "bg-ink/15 text-ink/60",
  cancelado: "bg-ink/15 text-ink/60",
};

const ETIQUETA_MODALIDAD: Record<ModalidadPedido, string> = {
  retiro: "Retiro",
  envio_propio: "Envío propio",
  envio_puni: "Envío por Puni",
};

type Props = {
  pedido: Pedido & { pedido_items: PedidoItem[] };
};

export default function TarjetaPedido({ pedido }: Props) {
  const fecha = new Date(pedido.created_at).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const datosCompradorDisponibles =
    pedido.nombre_comprador != null && pedido.telefono_comprador != null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-ink/40">{fecha}</p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${ESTILO_ESTADO[pedido.estado] ?? "bg-ink/10 text-ink/50"}`}
        >
          {ETIQUETA_ESTADO[pedido.estado] ?? pedido.estado}
        </span>
      </div>

      <p className="text-sm text-ink/80">
        {datosCompradorDisponibles
          ? `${pedido.nombre_comprador} · ${pedido.telefono_comprador}`
          : "Datos no disponibles"}
      </p>

      <div className="text-sm text-ink/60">
        <p>{ETIQUETA_MODALIDAD[pedido.modalidad]}</p>
        {pedido.modalidad !== "retiro" && pedido.direccion_envio && (
          <p>{pedido.direccion_envio}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {pedido.pedido_items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm text-ink/80">
            <span>
              {item.cantidad} × {item.nombre_capturado}
            </span>
            <span>${item.subtotal.toLocaleString("es-AR")}</span>
          </div>
        ))}
      </div>

      <p className="text-sm font-medium text-coral">
        ${pedido.total.toLocaleString("es-AR")}
      </p>

      {pedido.estado === "generado" && (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <form action={actualizarEstadoPedido}>
            <input type="hidden" name="pedidoId" value={pedido.id} />
            <input type="hidden" name="estadoActual" value={pedido.estado} />
            <input type="hidden" name="nuevoEstado" value="confirmado" />
            <button
              type="submit"
              className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-200"
            >
              Confirmar
            </button>
          </form>

          <form action={actualizarEstadoPedido}>
            <input type="hidden" name="pedidoId" value={pedido.id} />
            <input type="hidden" name="estadoActual" value={pedido.estado} />
            <input type="hidden" name="nuevoEstado" value="rechazado" />
            <button
              type="submit"
              className="px-1 py-3 text-xs font-medium text-ink/60 hover:text-coral"
            >
              Rechazar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
