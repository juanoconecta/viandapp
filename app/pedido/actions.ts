"use server";

import { headers } from "next/headers";
import { asegurarSesionPedido } from "@/app/pedido/sesion";
import { costoEnvioVigente, modalidadesDisponibles } from "@/lib/envios/modalidades";
import { hmacIpDesdeEnv } from "@/lib/pedidos/hmacIpServer";
import { debeLimitar, ventanaActual } from "@/lib/pedidos/limiteAbuso";
import { construirMensajePedido } from "@/lib/pedidos/mensaje";
import { detectarCambios } from "@/lib/pedidos/revalidacion";
import { calcularTotal, validarUnaSolaCocina } from "@/lib/pedidos/total";
import { createAdminClient } from "@/lib/supabase/admin";
import { telefonoParaWhatsapp } from "@/lib/viandera/telefono";
import type { ModalidadPedido, PedidoCambio, PedidoResultado } from "@/types";

export type ItemGenerarPedido = {
  viandaId: string;
  vianderaId: string;
  nombreVisto: string;
  precioVisto: number;
  cantidad: number;
};

export type DatosGenerarPedido = {
  idempotencyKey: string;
  items: ItemGenerarPedido[];
  modalidad: ModalidadPedido;
  costoEnvioEsperado: number;
  nombreComprador: string;
  telefonoComprador: string;
  direccionEnvio: string | null;
  aceptaMarketing: boolean;
};

export type ResultadoGenerarPedido =
  | { status: "limite_excedido"; mensaje: string }
  | { status: "revisar_carrito"; cambios: PedidoCambio[] }
  | { status: "error"; mensaje: string }
  | { status: "ok"; pedidoId: string; whatsappHref: string };

const UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MODALIDADES: ModalidadPedido[] = ["retiro", "envio_propio", "envio_puni"];
const ERROR_GENERICO = "No pudimos generar tu pedido. Intentá nuevamente.";

function errorGenerico(): ResultadoGenerarPedido {
  return { status: "error", mensaje: ERROR_GENERICO };
}

function esNumeroNoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
}

function esUuidCanonico(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_CANONICO.test(valor);
}

function validarDatos(valor: unknown): valor is DatosGenerarPedido {
  if (!valor || typeof valor !== "object") return false;
  const datos = valor as Partial<DatosGenerarPedido>;
  if (!esUuidCanonico(datos.idempotencyKey)) return false;
  if (!Array.isArray(datos.items) || datos.items.length < 1 || datos.items.length > 50) {
    return false;
  }

  const ids = new Set<string>();
  for (const item of datos.items) {
    if (
      !item ||
      typeof item !== "object" ||
      !esUuidCanonico(item.viandaId) ||
      !esUuidCanonico(item.vianderaId) ||
      typeof item.nombreVisto !== "string" ||
      !esNumeroNoNegativo(item.precioVisto) ||
      !Number.isInteger(item.cantidad) ||
      item.cantidad < 1 ||
      item.cantidad > 99 ||
      ids.has(item.viandaId)
    ) {
      return false;
    }
    ids.add(item.viandaId);
  }

  if (!validarUnaSolaCocina(datos.items)) return false;
  if (!MODALIDADES.includes(datos.modalidad as ModalidadPedido)) return false;
  if (!esNumeroNoNegativo(datos.costoEnvioEsperado)) return false;
  if (typeof datos.nombreComprador !== "string" || !datos.nombreComprador.trim()) return false;
  if (typeof datos.telefonoComprador !== "string" || !datos.telefonoComprador.trim()) {
    return false;
  }
  if (datos.direccionEnvio !== null && typeof datos.direccionEnvio !== "string") return false;
  if (datos.modalidad !== "retiro" && !datos.direccionEnvio?.trim()) return false;
  return typeof datos.aceptaMarketing === "boolean";
}

function primerIpForwarded(valor: string | null): string {
  return valor
    ?.split(",")
    .map((parte) => parte.trim())
    .find(Boolean) ?? "unknown";
}

function contadorValido(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 1;
}

function contieneMismatch(error: { message?: string; details?: string }): boolean {
  return `${error.message ?? ""} ${error.details ?? ""}`.includes(
    "idempotency_key_content_mismatch",
  );
}

export async function generarPedido(datos: DatosGenerarPedido): Promise<ResultadoGenerarPedido> {
  try {
    const admin = createAdminClient();
    const encabezados = await headers();
    const ip = primerIpForwarded(encabezados.get("x-forwarded-for"));
    const hashIp = hmacIpDesdeEnv(ip);
    const ahora = new Date();
    const ventanaHora = ventanaActual(ahora, 60).toISOString();

    const intentoIp = await admin.rpc("registrar_intento_limite", {
      p_clave: `ip:${hashIp}`,
      p_ventana_inicio: ventanaHora,
    });
    if (intentoIp.error || !contadorValido(intentoIp.data)) return errorGenerico();
    if (debeLimitar(intentoIp.data, 10)) {
      return {
        status: "limite_excedido",
        mensaje: "Alcanzaste el límite de pedidos. Intentá nuevamente más tarde.",
      };
    }

    // La sesión es solo una señal secundaria; la frontera por IP siempre se ejecuta primero.
    const sesion = await asegurarSesionPedido();
    const intentoSesion = await admin.rpc("registrar_intento_limite", {
      p_clave: `sesion:${sesion}`,
      p_ventana_inicio: ventanaHora,
    });
    if (intentoSesion.error || !contadorValido(intentoSesion.data)) return errorGenerico();
    if (debeLimitar(intentoSesion.data, 5)) {
      return {
        status: "limite_excedido",
        mensaje: "Ya generaste varios pedidos. Esperá un poco antes de volver a intentar.",
      };
    }

    const intentoGlobal = await admin.rpc("registrar_intento_limite", {
      p_clave: "global",
      p_ventana_inicio: ventanaActual(ahora, 5).toISOString(),
    });
    if (intentoGlobal.error || !contadorValido(intentoGlobal.data)) return errorGenerico();
    if (debeLimitar(intentoGlobal.data, 1000)) {
      console.error("INCIDENTE: límite global de generación de pedidos excedido");
      return {
        status: "limite_excedido",
        mensaje: "El servicio está temporalmente ocupado. Intentá nuevamente en unos minutos.",
      };
    }

    if (!validarDatos(datos)) return errorGenerico();

    const vianderaId = datos.items[0].vianderaId;
    const idsViandas = datos.items.map((item) => item.viandaId);
    const { data: viandas, error: errorViandas } = await admin
      .from("viandas")
      .select("id, nombre, precio, disponible")
      .eq("vianderas_id", vianderaId)
      .in("id", idsViandas);
    if (errorViandas || !viandas) return errorGenerico();

    const { data: viandera, error: errorViandera } = await admin
      .from("vianderas")
      .select(
        "id, nombre, telefono, activo, ofrece_retiro, ofrece_envio, costo_envio_propio",
      )
      .eq("id", vianderaId)
      .eq("activo", true)
      .maybeSingle();
    if (errorViandera || !viandera) return errorGenerico();

    const { data: adhesion, error: errorAdhesion } = await admin
      .from("puni_adhesiones")
      .select("estado, costo_envio_puni")
      .eq("viandera_id", vianderaId)
      .maybeSingle();
    if (errorAdhesion) return errorGenerico();

    const cambios = detectarCambios(datos.items, viandas);
    const disponibles = modalidadesDisponibles(viandera, adhesion);
    if (!disponibles.includes(datos.modalidad)) {
      cambios.push({ tipo: "modalidad_no_disponible", modalidad: datos.modalidad });
    } else {
      const costoActual = costoEnvioVigente(datos.modalidad, viandera, adhesion);
      if (costoActual !== datos.costoEnvioEsperado) {
        if (costoActual === null) {
          cambios.push({ tipo: "modalidad_no_disponible", modalidad: datos.modalidad });
        } else {
          cambios.push({
            tipo: "costo_envio_cambio",
            modalidad: datos.modalidad,
            costo_esperado: datos.costoEnvioEsperado,
            costo_actual: costoActual,
          });
        }
      }
    }
    if (cambios.length > 0) return { status: "revisar_carrito", cambios };

    const actualesPorId = new Map(viandas.map((vianda) => [vianda.id, vianda]));
    calcularTotal(
      datos.items.map((item) => ({
        precioCapturado: actualesPorId.get(item.viandaId)?.precio as number,
        cantidad: item.cantidad,
      })),
      datos.costoEnvioEsperado,
    );

    const telefonoNormalizado = telefonoParaWhatsapp(viandera.telefono);
    if (!telefonoNormalizado) {
      return {
        status: "error",
        mensaje: "La cocina no tiene un WhatsApp válido para recibir el pedido.",
      };
    }

    const nombreComprador = datos.nombreComprador.trim();
    const telefonoComprador = datos.telefonoComprador.trim();
    const direccionEnvio = datos.modalidad === "retiro" ? null : datos.direccionEnvio!.trim();
    const { data: resultadoAtomico, error: errorAtomico } = await admin.rpc(
      "crear_pedido_atomico",
      {
        p_idempotency_key: datos.idempotencyKey,
        p_vianderas_id: vianderaId,
        p_modalidad: datos.modalidad,
        p_costo_envio_esperado: datos.costoEnvioEsperado,
        p_items: datos.items.map((item) => ({
          vianda_id: item.viandaId,
          cantidad: item.cantidad,
          precio_esperado: item.precioVisto,
        })),
        p_nombre_comprador: nombreComprador,
        p_telefono_comprador: telefonoComprador,
        p_direccion_envio: direccionEnvio,
        p_acepta_marketing: datos.aceptaMarketing,
      },
    );

    if (errorAtomico) {
      if (contieneMismatch(errorAtomico)) {
        return {
          status: "error",
          mensaje: "El carrito cambió. Recargá el carrito antes de volver a intentar.",
        };
      }
      console.error("Falló la creación atómica de un pedido", { code: errorAtomico.code });
      return errorGenerico();
    }

    const resultado = resultadoAtomico as PedidoResultado | null;
    if (!resultado) return errorGenerico();
    if (!resultado.ok) return { status: "revisar_carrito", cambios: resultado.cambios };

    const pedido = resultado.pedido;
    const { data: itemsCapturados, error: errorItems } = await admin
      .from("pedido_items")
      .select("nombre_capturado, precio_capturado, cantidad")
      .eq("pedido_id", pedido.id);
    if (errorItems || !itemsCapturados) return errorGenerico();

    const mensaje = construirMensajePedido({
      vianderaNombre: viandera.nombre,
      nombreComprador: pedido.nombre_comprador ?? "",
      modalidad: pedido.modalidad,
      direccionEnvio: pedido.direccion_envio,
      costoEnvio: pedido.costo_envio_capturado,
      total: pedido.total,
      items: itemsCapturados.map((item) => ({
        nombre: item.nombre_capturado,
        precioCapturado: item.precio_capturado,
        cantidad: item.cantidad,
      })),
    });

    return {
      status: "ok",
      pedidoId: pedido.id,
      whatsappHref: `https://wa.me/${telefonoNormalizado}?text=${encodeURIComponent(mensaje)}`,
    };
  } catch {
    return errorGenerico();
  }
}
