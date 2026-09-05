import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  asegurarSesionPedidoMock,
  createAdminClientMock,
  headersMock,
  hmacIpDesdeEnvMock,
} = vi.hoisted(() => ({
  asegurarSesionPedidoMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  headersMock: vi.fn(),
  hmacIpDesdeEnvMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
vi.mock("@/app/pedido/sesion", () => ({
  asegurarSesionPedido: asegurarSesionPedidoMock,
}));
vi.mock("@/lib/pedidos/hmacIpServer", () => ({ hmacIpDesdeEnv: hmacIpDesdeEnvMock }));

import { generarPedido, type DatosGenerarPedido } from "./actions";

const PEDIDO_KEY = "10000000-0000-4000-8000-000000000001";
const VIANDERA_ID = "20000000-0000-4000-8000-000000000002";
const VIANDA_ID = "30000000-0000-4000-8000-000000000003";
const PEDIDO_ID = "40000000-0000-4000-8000-000000000004";

const entradaValida: DatosGenerarPedido = {
  idempotencyKey: PEDIDO_KEY,
  items: [
    {
      viandaId: VIANDA_ID,
      vianderaId: VIANDERA_ID,
      nombreVisto: "Tarta",
      precioVisto: 2500,
      cantidad: 2,
    },
  ],
  modalidad: "envio_propio",
  costoEnvioEsperado: 700,
  nombreComprador: "  Ana  ",
  telefonoComprador: "  3492555555  ",
  direccionEnvio: "  Belgrano 123  ",
  aceptaMarketing: false,
};

type Escenario = {
  contadores?: Partial<Record<"ip" | "sesion" | "global", number>>;
  errorContador?: "ip" | "sesion" | "global";
  viandas?: Array<{ id: string; nombre: string; precio: number | null; disponible: boolean }>;
  errorViandas?: boolean;
  viandera?: {
    id: string;
    nombre: string;
    telefono: string | null;
    activo: boolean;
    ofrece_retiro: boolean;
    ofrece_envio: boolean;
    costo_envio_propio: number | null;
  } | null;
  errorViandera?: boolean;
  adhesion?: { estado: "aprobada"; costo_envio_puni: number | null } | null;
  errorAdhesion?: boolean;
  resultadoAtomico?: unknown;
  errorAtomico?: { message?: string; details?: string } | null;
  itemsCapturados?: Array<{
    nombre_capturado: string;
    precio_capturado: number;
    cantidad: number;
  }>;
  errorItems?: boolean;
};

function crearAdminFalso(escenario: Escenario = {}) {
  const rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) => {
    if (nombre === "registrar_intento_limite") {
      const clave = String(args.p_clave);
      const tipo = clave.startsWith("ip:")
        ? "ip"
        : clave.startsWith("sesion:")
          ? "sesion"
          : "global";
      return escenario.errorContador === tipo
        ? { data: null, error: { message: "counter failed" } }
        : { data: escenario.contadores?.[tipo] ?? 1, error: null };
    }
    if (nombre === "crear_pedido_atomico") {
      return {
        data:
          escenario.resultadoAtomico ??
          ({
            ok: true,
            pedido: {
              id: PEDIDO_ID,
              modalidad: "envio_propio",
              costo_envio_capturado: 700,
              total: 5700,
              nombre_comprador: "Ana",
              telefono_comprador: "3492555555",
              direccion_envio: "Belgrano 123",
            },
            cambios: [],
          } as const),
        error: escenario.errorAtomico ?? null,
      };
    }
    throw new Error(`RPC inesperada: ${nombre}`);
  });

  const from = vi.fn((tabla: string) => {
    if (tabla === "viandas") {
      const terminal = Promise.resolve({
        data:
          escenario.viandas ??
          [{ id: VIANDA_ID, nombre: "Tarta", precio: 2500, disponible: true }],
        error: escenario.errorViandas ? { message: "viandas failed" } : null,
      });
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ in: vi.fn(() => terminal) })),
        })),
      };
    }
    if (tabla === "vianderas") {
      const terminal = Promise.resolve({
        data:
          escenario.viandera === undefined
            ? {
                id: VIANDERA_ID,
                nombre: "Cocina de Marta",
                telefono: "+54 9 3492 555555",
                activo: true,
                ofrece_retiro: true,
                ofrece_envio: true,
                costo_envio_propio: 700,
              }
            : escenario.viandera,
        error: escenario.errorViandera ? { message: "viandera failed" } : null,
      });
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(() => terminal) })),
          })),
        })),
      };
    }
    if (tabla === "puni_adhesiones") {
      const terminal = Promise.resolve({
        data: escenario.adhesion ?? null,
        error: escenario.errorAdhesion ? { message: "adhesion failed" } : null,
      });
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(() => terminal) })),
        })),
      };
    }
    if (tabla === "pedido_items") {
      const terminal = Promise.resolve({
        data:
          escenario.itemsCapturados ??
          [{ nombre_capturado: "Tarta", precio_capturado: 2500, cantidad: 2 }],
        error: escenario.errorItems ? { message: "items failed" } : null,
      });
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => terminal) })),
      };
    }
    throw new Error(`Tabla inesperada: ${tabla}`);
  });

  return { rpc, from };
}

function llamadasRpc(admin: ReturnType<typeof crearAdminFalso>, nombre: string) {
  return admin.rpc.mock.calls.filter(([rpcNombre]) => rpcNombre === nombre);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-04T10:07:32.000Z"));
  headersMock.mockResolvedValue(new Headers({ "x-forwarded-for": " 203.0.113.8, 10.0.0.2" }));
  hmacIpDesdeEnvMock.mockReturnValue("hash-seguro");
  asegurarSesionPedidoMock.mockResolvedValue("50000000-0000-4000-8000-000000000005");
});

describe("generarPedido", () => {
  it("bloquea el intento 11 por IP antes de sesión, global, catálogo y orden", async () => {
    const admin = crearAdminFalso({ contadores: { ip: 11 } });
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido(entradaValida);

    expect(resultado.status).toBe("limite_excedido");
    expect(hmacIpDesdeEnvMock).toHaveBeenCalledWith("203.0.113.8");
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("registrar_intento_limite", {
      p_clave: "ip:hash-seguro",
      p_ventana_inicio: "2026-09-04T10:00:00.000Z",
    });
    expect(asegurarSesionPedidoMock).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("bloquea el intento 6 por sesión después de IP y antes de global y orden", async () => {
    const admin = crearAdminFalso({ contadores: { sesion: 6 } });
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido(entradaValida);

    expect(resultado.status).toBe("limite_excedido");
    expect(admin.rpc.mock.calls.map(([nombre, args]) => [nombre, args.p_clave])).toEqual([
      ["registrar_intento_limite", "ip:hash-seguro"],
      ["registrar_intento_limite", "sesion:50000000-0000-4000-8000-000000000005"],
    ]);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("registra incidente global sin datos personales y corta el intento 1001", async () => {
    const admin = crearAdminFalso({ contadores: { global: 1001 } });
    createAdminClientMock.mockReturnValue(admin);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const resultado = await generarPedido(entradaValida);

    expect(resultado.status).toBe("limite_excedido");
    expect(admin.rpc).toHaveBeenCalledTimes(3);
    expect(admin.rpc).toHaveBeenLastCalledWith("registrar_intento_limite", {
      p_clave: "global",
      p_ventana_inicio: "2026-09-04T10:05:00.000Z",
    });
    expect(admin.from).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    const incidente = error.mock.calls.flat().join(" ");
    expect(incidente).toContain("INCIDENTE");
    expect(incidente).not.toContain("Ana");
    expect(incidente).not.toContain("203.0.113.8");
  });

  it.each(["ip", "sesion", "global"] as const)(
    "falla cerrado si falla el contador %s",
    async (errorContador) => {
      const admin = crearAdminFalso({ errorContador });
      createAdminClientMock.mockReturnValue(admin);

      const resultado = await generarPedido(entradaValida);

      expect(resultado).toMatchObject({ status: "error" });
      expect(admin.from).not.toHaveBeenCalled();
      expect(llamadasRpc(admin, "crear_pedido_atomico")).toHaveLength(0);
    },
  );

  it("usa unknown si no hay IP y rechaza entrada malformada solo después de los tres límites", async () => {
    const admin = crearAdminFalso();
    createAdminClientMock.mockReturnValue(admin);
    headersMock.mockResolvedValue(new Headers());

    const resultado = await generarPedido({ ...entradaValida, items: [] });

    expect(resultado.status).toBe("error");
    expect(hmacIpDesdeEnvMock).toHaveBeenCalledWith("unknown");
    expect(admin.rpc).toHaveBeenCalledTimes(3);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rechaza cocinas mezcladas después de los tres límites y antes del catálogo", async () => {
    const admin = crearAdminFalso();
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido({
      ...entradaValida,
      items: [
        entradaValida.items[0],
        {
          ...entradaValida.items[0],
          viandaId: "60000000-0000-4000-8000-000000000006",
          vianderaId: "70000000-0000-4000-8000-000000000007",
        },
      ],
    });

    expect(resultado.status).toBe("error");
    expect(admin.rpc).toHaveBeenCalledTimes(3);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("devuelve juntos los cambios literales de precio, modalidad y envío sin crear orden", async () => {
    const admin = crearAdminFalso({
      viandas: [{ id: VIANDA_ID, nombre: "Tarta", precio: 2800, disponible: true }],
      viandera: {
        id: VIANDERA_ID,
        nombre: "Cocina de Marta",
        telefono: "+54 9 3492 555555",
        activo: true,
        ofrece_retiro: true,
        ofrece_envio: false,
        costo_envio_propio: 900,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido(entradaValida);

    expect(resultado).toEqual({
      status: "revisar_carrito",
      cambios: [
        {
          tipo: "precio_cambio",
          vianda_id: VIANDA_ID,
          precio_esperado: 2500,
          precio_actual: 2800,
        },
        { tipo: "modalidad_no_disponible", modalidad: "envio_propio" },
      ],
    });
    expect(llamadasRpc(admin, "crear_pedido_atomico")).toHaveLength(0);

    const adminCosto = crearAdminFalso({
      viandera: {
        id: VIANDERA_ID,
        nombre: "Cocina de Marta",
        telefono: "+54 9 3492 555555",
        activo: true,
        ofrece_retiro: true,
        ofrece_envio: true,
        costo_envio_propio: 900,
      },
    });
    createAdminClientMock.mockReturnValue(adminCosto);

    await expect(generarPedido(entradaValida)).resolves.toEqual({
      status: "revisar_carrito",
      cambios: [
        {
          tipo: "costo_envio_cambio",
          modalidad: "envio_propio",
          costo_esperado: 700,
          costo_actual: 900,
        },
      ],
    });
    expect(llamadasRpc(adminCosto, "crear_pedido_atomico")).toHaveLength(0);
  });

  it("devuelve sin modificar los cambios autoritativos de la función atómica", async () => {
    const cambios = [{ tipo: "plato_no_disponible" as const, vianda_id: VIANDA_ID }];
    const admin = crearAdminFalso({ resultadoAtomico: { ok: false, pedido: null, cambios } });
    createAdminClientMock.mockReturnValue(admin);

    await expect(generarPedido(entradaValida)).resolves.toEqual({
      status: "revisar_carrito",
      cambios,
    });
  });

  it("pide recargar el carrito cuando la key fue reutilizada con otro contenido", async () => {
    const admin = crearAdminFalso({
      errorAtomico: {
        message: "P0001",
        details: "idempotency_key_content_mismatch",
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido(entradaValida);

    expect(resultado).toMatchObject({ status: "error" });
    expect(resultado.status === "error" ? resultado.mensaje.toLowerCase() : "").toContain(
      "recargá el carrito",
    );
  });

  it("envía los argumentos exactos y arma WhatsApp con captura y total autoritativos", async () => {
    const admin = crearAdminFalso({
      itemsCapturados: [
        { nombre_capturado: "Tarta actual", precio_capturado: 2600, cantidad: 2 },
      ],
      resultadoAtomico: {
        ok: true,
        pedido: {
          id: PEDIDO_ID,
          modalidad: "envio_propio",
          costo_envio_capturado: 700,
          total: 5900,
          nombre_comprador: "Ana",
          telefono_comprador: "3492555555",
          direccion_envio: "Belgrano 123",
        },
        cambios: [],
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido(entradaValida);

    expect(llamadasRpc(admin, "crear_pedido_atomico")).toEqual([
      [
        "crear_pedido_atomico",
        {
          p_idempotency_key: PEDIDO_KEY,
          p_vianderas_id: VIANDERA_ID,
          p_modalidad: "envio_propio",
          p_costo_envio_esperado: 700,
          p_items: [{ vianda_id: VIANDA_ID, cantidad: 2, precio_esperado: 2500 }],
          p_nombre_comprador: "Ana",
          p_telefono_comprador: "3492555555",
          p_direccion_envio: "Belgrano 123",
          p_acepta_marketing: false,
        },
      ],
    ]);
    expect(resultado.status).toBe("ok");
    if (resultado.status !== "ok") throw new Error("Se esperaba un pedido exitoso");
    expect(resultado.pedidoId).toBe(PEDIDO_ID);
    expect(resultado.whatsappHref.startsWith("https://wa.me/5493492555555?text=")).toBe(true);
    const mensaje = decodeURIComponent(resultado.whatsappHref.split("?text=")[1]);
    expect(mensaje).toContain("2 x Tarta actual");
    expect(mensaje).toContain("$ 5.900");
    expect(mensaje).not.toContain("$ 5.700");
  });

  it.each([null, "---"])(
    "impide crear la orden si el WhatsApp de la cocina es inutilizable: %s",
    async (telefono) => {
      const admin = crearAdminFalso({
        viandera: {
          id: VIANDERA_ID,
          nombre: "Cocina de Marta",
          telefono,
          activo: true,
          ofrece_retiro: true,
          ofrece_envio: true,
          costo_envio_propio: 700,
        },
      });
      createAdminClientMock.mockReturnValue(admin);

      const resultado = await generarPedido(entradaValida);

      expect(resultado).toMatchObject({ status: "error" });
      expect(resultado.status === "error" ? resultado.mensaje : "").toContain("WhatsApp");
      expect(llamadasRpc(admin, "crear_pedido_atomico")).toHaveLength(0);
    },
  );
});
