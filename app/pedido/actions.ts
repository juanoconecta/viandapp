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
import type { ModalidadPedido, Pedido, PedidoCambio, PedidoResultado } from "@/types";

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
      item.cantidad > 50 ||
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

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function esTextoONulo(valor: unknown): valor is string | null {
  return valor === null || typeof valor === "string";
}

function esModalidad(valor: unknown): valor is ModalidadPedido {
  return typeof valor === "string" && MODALIDADES.includes(valor as ModalidadPedido);
}

function esCambioPedido(valor: unknown): valor is PedidoCambio {
  if (!esObjeto(valor) || typeof valor.tipo !== "string") return false;
  switch (valor.tipo) {
    case "plato_no_disponible":
      return esUuidCanonico(valor.vianda_id);
    case "precio_cambio":
      return (
        esUuidCanonico(valor.vianda_id) &&
        esNumeroNoNegativo(valor.precio_esperado) &&
        esNumeroNoNegativo(valor.precio_actual)
      );
    case "modalidad_no_disponible":
      return valor.modalidad === null || typeof valor.modalidad === "string";
    case "costo_envio_cambio":
      return (
        esModalidad(valor.modalidad) &&
        esNumeroNoNegativo(valor.costo_esperado) &&
        esNumeroNoNegativo(valor.costo_actual)
      );
    default:
      return false;
  }
}

function esPedido(valor: unknown): valor is Pedido {
  if (!esObjeto(valor)) return false;
  return (
    esUuidCanonico(valor.id) &&
    esUuidCanonico(valor.idempotency_key) &&
    typeof valor.request_hash === "string" &&
    valor.request_hash.length > 0 &&
    esUuidCanonico(valor.vianderas_id) &&
    esModalidad(valor.modalidad) &&
    esNumeroNoNegativo(valor.costo_envio_capturado) &&
    esNumeroNoNegativo(valor.total) &&
    (valor.estado === "generado" ||
      valor.estado === "confirmado" ||
      valor.estado === "rechazado" ||
      valor.estado === "cancelado") &&
    esTextoONulo(valor.nombre_comprador) &&
    esTextoONulo(valor.telefono_comprador) &&
    esTextoONulo(valor.direccion_envio) &&
    typeof valor.acepta_marketing === "boolean" &&
    esTextoONulo(valor.consentimiento_marketing_en) &&
    typeof valor.purgar_datos_en === "string" &&
    typeof valor.datos_purgados === "boolean" &&
    typeof valor.created_at === "string" &&
    typeof valor.updated_at === "string"
  );
}

function esPedidoResultado(valor: unknown): valor is PedidoResultado {
  if (!esObjeto(valor) || typeof valor.ok !== "boolean" || !Array.isArray(valor.cambios)) {
    return false;
  }
  if (!valor.cambios.every(esCambioPedido)) return false;
  if (valor.ok) return valor.cambios.length === 0 && esPedido(valor.pedido);
  return valor.pedido === null;
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

    if (!esPedidoResultado(resultadoAtomico)) return errorGenerico();
    const resultado = resultadoAtomico;
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
