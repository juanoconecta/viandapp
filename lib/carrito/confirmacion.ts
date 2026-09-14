import type {
  DatosGenerarPedido,
  ResultadoGenerarPedido,
} from "@/app/pedido/actions";
import {
  CLAVE_CARRITO,
  mismoContenidoCarrito,
  parsearCarrito,
  type CarritoAlmacenado,
} from "./estado";
import {
  invalidarClaveCheckout,
  obtenerClaveCheckout,
  type AlmacenamientoSesion,
} from "./sesionCheckout";

type DatosSinClave = Omit<DatosGenerarPedido, "idempotencyKey">;

type DependenciasConfirmacion = {
  localStorage: Pick<Storage, "getItem" | "removeItem">;
  sessionStorage: AlmacenamientoSesion;
  generarUuid: () => string;
  generarPedido: (datos: DatosGenerarPedido) => Promise<ResultadoGenerarPedido>;
  navegar: (href: string) => void;
};

const ERROR_CONEXION =
  "No pudimos comunicarnos con ViandApp. Revisá tu conexión e intentá nuevamente.";

export async function ejecutarConfirmacion(
  entrada: { carrito: CarritoAlmacenado; datos: DatosSinClave },
  dependencias: DependenciasConfirmacion,
): Promise<ResultadoGenerarPedido> {
  let respuesta: ResultadoGenerarPedido;
  try {
    const idempotencyKey = obtenerClaveCheckout(
      entrada.carrito,
      dependencias.sessionStorage,
      dependencias.generarUuid,
    );
    respuesta = await dependencias.generarPedido({
      ...entrada.datos,
      idempotencyKey,
    });
  } catch {
    return { status: "error", mensaje: ERROR_CONEXION };
  }

  if (respuesta.status === "ok") {
    try {
      const guardado = parsearCarrito(
        dependencias.localStorage.getItem(CLAVE_CARRITO),
      );
      if (mismoContenidoCarrito(guardado, entrada.carrito)) {
        dependencias.localStorage.removeItem(CLAVE_CARRITO);
      }
    } catch {
      // El pedido ya existe: limpiar el cache local es best-effort y no
      // puede impedir que la persona continúe al WhatsApp retornado.
    } finally {
      dependencias.navegar(respuesta.whatsappHref);
    }
  } else if (respuesta.status === "revisar_carrito") {
    try {
      invalidarClaveCheckout(dependencias.sessionStorage);
    } catch {
      // Los cambios del servidor son autoritativos aunque el navegador no
      // permita invalidar la optimización local de idempotencia.
    }
  }

  return respuesta;
}
