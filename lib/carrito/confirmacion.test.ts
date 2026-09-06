import { describe, expect, it } from "vitest";
import { ejecutarConfirmacion } from "./confirmacion";
import { CLAVE_CARRITO, serializarCarrito } from "./estado";
import { CLAVE_SESION_CHECKOUT, fingerprintCheckout } from "./sesionCheckout";

const COCINA = "11111111-1111-4111-8111-111111111111";
const PLATO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY = "33333333-3333-4333-8333-333333333333";
const carrito = { vianderaId: COCINA, items: [{ platoId: PLATO, cantidad: 2 }] };

function memoria(inicial: Record<string, string>) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => datos.set(clave, valor),
    removeItem: (clave: string) => datos.delete(clave),
    valor: (clave: string) => datos.get(clave) ?? null,
  };
}

const datos = {
  items: [{ viandaId: PLATO, vianderaId: COCINA, nombreVisto: "Tarta", precioVisto: 4200, cantidad: 2 }],
  modalidad: "retiro" as const,
  costoEnvioEsperado: 0,
  nombreComprador: "Ana",
  telefonoComprador: "3492123456",
  direccionEnvio: null,
  aceptaMarketing: false,
};

describe("confirmación ante fallos externos", () => {
  it("convierte un rechazo de red en error recuperable sin borrar carrito ni invalidar la key", async () => {
    const local = memoria({ [CLAVE_CARRITO]: serializarCarrito(carrito) });
    const sesionGuardada = JSON.stringify({ fingerprint: fingerprintCheckout(carrito), idempotencyKey: KEY });
    const sesion = memoria({ [CLAVE_SESION_CHECKOUT]: sesionGuardada });
    let navegacion: string | null = null;

    const resultado = await ejecutarConfirmacion(
      { carrito, datos },
      {
        localStorage: local,
        sessionStorage: sesion,
        generarUuid: () => { throw new Error("no debe regenerar"); },
        generarPedido: async () => { throw new Error("red caída"); },
        navegar: (href) => { navegacion = href; },
      },
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No pudimos comunicarnos con ViandApp. Revisá tu conexión e intentá nuevamente." });
    expect(local.valor(CLAVE_CARRITO)).toBe(serializarCarrito(carrito));
    expect(sesion.valor(CLAVE_SESION_CHECKOUT)).toBe(sesionGuardada);
    expect(navegacion).toBeNull();
  });

  it("en éxito borra sólo el carrito coincidente y navega en la misma pestaña", async () => {
    const local = memoria({ [CLAVE_CARRITO]: serializarCarrito(carrito) });
    const sesion = memoria({});
    let navegacion: string | null = null;
    const resultado = await ejecutarConfirmacion(
      { carrito, datos },
      {
        localStorage: local,
        sessionStorage: sesion,
        generarUuid: () => KEY,
        generarPedido: async () => ({ status: "ok", pedidoId: "44444444-4444-4444-8444-444444444444", whatsappHref: "https://wa.me/543492123456" }),
        navegar: (href) => { navegacion = href; },
      },
    );
    expect(resultado.status).toBe("ok");
    expect(local.valor(CLAVE_CARRITO)).toBeNull();
    expect(navegacion).toBe("https://wa.me/543492123456");
  });

  it("invalida la key al pedir revisión pero conserva el carrito", async () => {
    const local = memoria({ [CLAVE_CARRITO]: serializarCarrito(carrito) });
    const sesion = memoria({
      [CLAVE_SESION_CHECKOUT]: JSON.stringify({ fingerprint: fingerprintCheckout(carrito), idempotencyKey: KEY }),
    });
    const resultado = await ejecutarConfirmacion(
      { carrito, datos },
      {
        localStorage: local,
        sessionStorage: sesion,
        generarUuid: () => KEY,
        generarPedido: async () => ({ status: "revisar_carrito", cambios: [{ tipo: "plato_no_disponible", vianda_id: PLATO }] }),
        navegar: () => undefined,
      },
    );
    expect(resultado.status).toBe("revisar_carrito");
    expect(local.valor(CLAVE_CARRITO)).toBe(serializarCarrito(carrito));
    expect(sesion.valor(CLAVE_SESION_CHECKOUT)).toBeNull();
  });

  it.each(["lectura", "borrado"])(
    "navega una sola vez y conserva ok si falla el %s de localStorage después de crear",
    async (fallo) => {
      let navegaciones = 0;
      let llamadasPedido = 0;
      const local = {
        getItem: () => {
          if (fallo === "lectura") throw new Error("storage bloqueado");
          return serializarCarrito(carrito);
        },
        removeItem: () => {
          if (fallo === "borrado") throw new Error("storage bloqueado");
        },
      };
      const resultado = await ejecutarConfirmacion(
        { carrito, datos },
        {
          localStorage: local,
          sessionStorage: memoria({}),
          generarUuid: () => KEY,
          generarPedido: async () => {
            llamadasPedido += 1;
            return { status: "ok", pedidoId: "44444444-4444-4444-8444-444444444444", whatsappHref: "https://wa.me/543492123456" };
          },
          navegar: () => { navegaciones += 1; },
        },
      );
      expect(resultado.status).toBe("ok");
      expect(llamadasPedido).toBe(1);
      expect(navegaciones).toBe(1);
    },
  );
});
