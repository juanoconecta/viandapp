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

const pedidoValido = {
  id: PEDIDO_ID,
  idempotency_key: PEDIDO_KEY,
  request_hash: "0123456789abcdef0123456789abcdef",
  vianderas_id: VIANDERA_ID,
  modalidad: "envio_propio" as const,
  costo_envio_capturado: 700,
  total: 5700,
  estado: "generado" as const,
  nombre_comprador: "Ana",
  telefono_comprador: "3492555555",
  direccion_envio: "Belgrano 123",
  acepta_marketing: false,
  consentimiento_marketing_en: null,
  purgar_datos_en: "2026-12-03T10:07:32.000Z",
  datos_purgados: false,
  created_at: "2026-09-04T10:07:32.000Z",
  updated_at: "2026-09-04T10:07:32.000Z",
};

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
  datosContador?: Partial<Record<"ip" | "sesion" | "global", unknown>>;
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

type ConsultaRegistrada = {
  tabla: string;
  select?: string;
  filtros: Array<{ operador: "eq" | "in"; columna: string; valor: unknown }>;
};

function crearAdminFalso(escenario: Escenario = {}) {
  const consultas: ConsultaRegistrada[] = [];
  const rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) => {
    if (nombre === "registrar_intento_limite") {
      const clave = String(args.p_clave);
      const tipo = clave.startsWith("ip:")
        ? "ip"
        : clave.startsWith("sesion:")
          ? "sesion"
          : "global";
      const tieneDatoForzado =
        escenario.datosContador !== undefined &&
        Object.prototype.hasOwnProperty.call(escenario.datosContador, tipo);
      return escenario.errorContador === tipo
        ? { data: null, error: { message: "counter failed" } }
        : {
            data: tieneDatoForzado
              ? escenario.datosContador?.[tipo]
              : (escenario.contadores?.[tipo] ?? 1),
            error: null,
          };
    }
    if (nombre === "crear_pedido_atomico") {
      return {
        data:
          escenario.resultadoAtomico ??
          ({
            ok: true,
            pedido: pedidoValido,
            cambios: [],
          } as const),
        error: escenario.errorAtomico ?? null,
      };
    }
    throw new Error(`RPC inesperada: ${nombre}`);
  });

  const from = vi.fn((tabla: string) => {
    const consulta: ConsultaRegistrada = { tabla, filtros: [] };
    consultas.push(consulta);
    if (tabla === "viandas") {
      const terminal = Promise.resolve({
        data:
          escenario.viandas ??
          [{ id: VIANDA_ID, nombre: "Tarta", precio: 2500, disponible: true }],
        error: escenario.errorViandas ? { message: "viandas failed" } : null,
      });
      return {
        select: vi.fn((columnas: string) => {
          consulta.select = columnas;
          return {
            eq: vi.fn((columna: string, valor: unknown) => {
              consulta.filtros.push({ operador: "eq", columna, valor });
              return {
                in: vi.fn((columnaIn: string, valorIn: unknown) => {
                  consulta.filtros.push({ operador: "in", columna: columnaIn, valor: valorIn });
                  return terminal;
                }),
              };
            }),
          };
        }),
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
        select: vi.fn((columnas: string) => {
          consulta.select = columnas;
          return {
            eq: vi.fn((primeraColumna: string, primerValor: unknown) => {
              consulta.filtros.push({
                operador: "eq",
                columna: primeraColumna,
                valor: primerValor,
              });
              return {
                eq: vi.fn((segundaColumna: string, segundoValor: unknown) => {
                  consulta.filtros.push({
                    operador: "eq",
                    columna: segundaColumna,
                    valor: segundoValor,
                  });
                  return { maybeSingle: vi.fn(() => terminal) };
                }),
              };
            }),
          };
        }),
      };
    }
    if (tabla === "puni_adhesiones") {
      const terminal = Promise.resolve({
        data: escenario.adhesion ?? null,
        error: escenario.errorAdhesion ? { message: "adhesion failed" } : null,
      });
      return {
        select: vi.fn((columnas: string) => {
          consulta.select = columnas;
          return {
            eq: vi.fn((columna: string, valor: unknown) => {
              consulta.filtros.push({ operador: "eq", columna, valor });
              return { maybeSingle: vi.fn(() => terminal) };
            }),
          };
        }),
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
        select: vi.fn((columnas: string) => {
          consulta.select = columnas;
          return {
            eq: vi.fn((columna: string, valor: unknown) => {
              consulta.filtros.push({ operador: "eq", columna, valor });
              return terminal;
            }),
          };
        }),
      };
    }
    throw new Error(`Tabla inesperada: ${tabla}`);
  });

  return { rpc, from, consultas };
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

  it.each([null, 0, 1.5, "2"])(
    "falla cerrado si el contador devuelve un dato inválido: %s",
    async (datoInvalido) => {
      const admin = crearAdminFalso({ datosContador: { ip: datoInvalido } });
      createAdminClientMock.mockReturnValue(admin);

      await expect(generarPedido(entradaValida)).resolves.toEqual({
        status: "error",
        mensaje: "No pudimos generar tu pedido. Intentá nuevamente.",
      });
      expect(admin.rpc).toHaveBeenCalledTimes(1);
      expect(asegurarSesionPedidoMock).not.toHaveBeenCalled();
      expect(admin.from).not.toHaveBeenCalled();
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

  it("acepta cantidad 50 y la envía a la función atómica", async () => {
    const admin = crearAdminFalso({
      itemsCapturados: [
        { nombre_capturado: "Tarta", precio_capturado: 2500, cantidad: 50 },
      ],
      resultadoAtomico: {
        ok: true,
        pedido: { ...pedidoValido, total: 125700 },
        cambios: [],
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido({
      ...entradaValida,
      items: [{ ...entradaValida.items[0], cantidad: 50 }],
    });

    expect(resultado.status).toBe("ok");
    expect(llamadasRpc(admin, "crear_pedido_atomico")[0][1]).toMatchObject({
      p_items: [{ vianda_id: VIANDA_ID, cantidad: 50, precio_esperado: 2500 }],
    });
  });

  it("rechaza cantidad 51 después de los límites y antes del catálogo", async () => {
    const admin = crearAdminFalso();
    createAdminClientMock.mockReturnValue(admin);

    const resultado = await generarPedido({
      ...entradaValida,
      items: [{ ...entradaValida.items[0], cantidad: 51 }],
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

  it.each([
    ["objeto vacío", {}],
    ["array", []],
    ["ok false incompleto", { ok: false }],
    ["ok false sin pedido nulo", { ok: false, pedido: {}, cambios: [] }],
    [
      "cambio anidado inválido",
      { ok: false, pedido: null, cambios: [{ tipo: "precio_cambio", vianda_id: VIANDA_ID }] },
    ],
    ["ok true incompleto", { ok: true, pedido: {}, cambios: [] }],
    [
      "pedido anidado inválido",
      { ok: true, pedido: { ...pedidoValido, total: "5700" }, cambios: [] },
    ],
    [
      "ok true con cambios",
      {
        ok: true,
        pedido: pedidoValido,
        cambios: [{ tipo: "plato_no_disponible", vianda_id: VIANDA_ID }],
      },
    ],
  ])("falla cerrado ante resultado atómico malformado: %s", async (_caso, resultadoAtomico) => {
    const admin = crearAdminFalso({ resultadoAtomico });
    createAdminClientMock.mockReturnValue(admin);

    await expect(generarPedido(entradaValida)).resolves.toEqual({
      status: "error",
      mensaje: "No pudimos generar tu pedido. Intentá nuevamente.",
    });
    expect(admin.consultas.some(({ tabla }) => tabla === "pedido_items")).toBe(false);
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
          ...pedidoValido,
          total: 5900,
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
    expect(admin.consultas).toEqual([
      {
        tabla: "viandas",
        select: "id, nombre, precio, disponible",
        filtros: [
          { operador: "eq", columna: "vianderas_id", valor: VIANDERA_ID },
          { operador: "in", columna: "id", valor: [VIANDA_ID] },
        ],
      },
      {
        tabla: "vianderas",
        select:
          "id, nombre, telefono, activo, ofrece_retiro, ofrece_envio, costo_envio_propio",
        filtros: [
          { operador: "eq", columna: "id", valor: VIANDERA_ID },
          { operador: "eq", columna: "activo", valor: true },
        ],
      },
      {
        tabla: "puni_adhesiones",
        select: "estado, costo_envio_puni",
        filtros: [{ operador: "eq", columna: "viandera_id", valor: VIANDERA_ID }],
      },
      {
        tabla: "pedido_items",
        select: "nombre_capturado, precio_capturado, cantidad",
        filtros: [{ operador: "eq", columna: "pedido_id", valor: PEDIDO_ID }],
      },
    ]);
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
