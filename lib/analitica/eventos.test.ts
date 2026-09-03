import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "../supabase/admin";
import { registrarEvento, sanitizarEvento } from "./eventos";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

const UUID_VALIDO = "550e8400-e29b-41d4-a716-446655440000";
const UUID_VALIDO_2 = "6b1f6f2e-0a2e-4d3b-9a3d-2b6a9f7d1c4a";

describe("sanitizarEvento — límite de entrada (unknown)", () => {
  it("rechaza null", () => {
    expect(sanitizarEvento(null)).toBeNull();
  });

  it("rechaza undefined", () => {
    expect(sanitizarEvento(undefined)).toBeNull();
  });

  it("rechaza un array", () => {
    expect(sanitizarEvento(["explore_viewed"])).toBeNull();
  });

  it("rechaza un string", () => {
    expect(sanitizarEvento("explore_viewed")).toBeNull();
  });

  it("rechaza un número", () => {
    expect(sanitizarEvento(42)).toBeNull();
  });

  it("rechaza un objeto sin nombre", () => {
    expect(sanitizarEvento({})).toBeNull();
  });

  it("rechaza un nombre de evento desconocido", () => {
    expect(sanitizarEvento({ nombre: "evento_inventado" })).toBeNull();
  });

  it("rechaza un Date como payload completo", () => {
    expect(sanitizarEvento(new Date())).toBeNull();
  });

  it("rechaza un Map como payload completo", () => {
    expect(sanitizarEvento(new Map([["nombre", "explore_viewed"]]))).toBeNull();
  });

  it("rechaza metadata anidada como objeto en vez de escalar", () => {
    const resultado = sanitizarEvento({
      nombre: "explore_viewed",
      metadata: { origen: { valor: "explorar" } },
    });
    expect(resultado?.metadata).toBeUndefined();
  });

  it("rechaza metadata que en sí misma no es un objeto plano", () => {
    expect(
      sanitizarEvento({ nombre: "explore_viewed", metadata: ["origen"] })
        ?.metadata,
    ).toBeUndefined();
    expect(
      sanitizarEvento({ nombre: "explore_viewed", metadata: "origen" })
        ?.metadata,
    ).toBeUndefined();
  });

  it("rechaza un Date como metadata", () => {
    expect(
      sanitizarEvento({ nombre: "explore_viewed", metadata: new Date() })
        ?.metadata,
    ).toBeUndefined();
  });

  it("rechaza un Map como metadata", () => {
    expect(
      sanitizarEvento({
        nombre: "explore_viewed",
        metadata: new Map([["origen", "explorar"]]),
      })?.metadata,
    ).toBeUndefined();
  });

  it("acepta los siete nombres de evento definidos, con los IDs que cada uno exige", () => {
    expect(sanitizarEvento({ nombre: "explore_viewed" })?.nombre).toBe(
      "explore_viewed",
    );
    expect(sanitizarEvento({ nombre: "search_submitted" })?.nombre).toBe(
      "search_submitted",
    );
    expect(sanitizarEvento({ nombre: "filter_applied" })?.nombre).toBe(
      "filter_applied",
    );
    expect(
      sanitizarEvento({ nombre: "profile_viewed", vianderaId: UUID_VALIDO })
        ?.nombre,
    ).toBe("profile_viewed");
    expect(
      sanitizarEvento({ nombre: "dish_selected", viandaId: UUID_VALIDO })
        ?.nombre,
    ).toBe("dish_selected");
    expect(
      sanitizarEvento({ nombre: "whatsapp_intent", viandaId: UUID_VALIDO })
        ?.nombre,
    ).toBe("whatsapp_intent");
    expect(
      sanitizarEvento({ nombre: "whatsapp_clicked", vianderaId: UUID_VALIDO })
        ?.nombre,
    ).toBe("whatsapp_clicked");
  });
});

describe("sanitizarEvento — eventos de exploración nunca aceptan IDs", () => {
  it.each(["explore_viewed", "search_submitted", "filter_applied"] as const)(
    "%s ignora vianderaId y viandaId aunque sean UUID válidos",
    (nombre) => {
      const resultado = sanitizarEvento({
        nombre,
        vianderaId: UUID_VALIDO,
        viandaId: UUID_VALIDO_2,
      });
      expect(resultado).not.toBeNull();
      expect(resultado?.vianderaId).toBeUndefined();
      expect(resultado?.viandaId).toBeUndefined();
    },
  );
});

describe("sanitizarEvento — IDs requeridos: rechazo del evento completo", () => {
  it("profile_viewed sin vianderaId se rechaza por completo", () => {
    expect(sanitizarEvento({ nombre: "profile_viewed" })).toBeNull();
  });

  it("profile_viewed con vianderaId inválido se rechaza por completo", () => {
    expect(
      sanitizarEvento({ nombre: "profile_viewed", vianderaId: "no-es-uuid" }),
    ).toBeNull();
  });

  it("profile_viewed con vianderaId válido se acepta y no lee viandaId", () => {
    const resultado = sanitizarEvento({
      nombre: "profile_viewed",
      vianderaId: UUID_VALIDO,
      viandaId: UUID_VALIDO_2,
    });
    expect(resultado?.vianderaId).toBe(UUID_VALIDO);
    expect(resultado?.viandaId).toBeUndefined();
  });

  it("dish_selected sin viandaId se rechaza por completo", () => {
    expect(sanitizarEvento({ nombre: "dish_selected" })).toBeNull();
  });

  it("dish_selected con viandaId inválido (intento de inyección) se rechaza por completo", () => {
    expect(
      sanitizarEvento({
        nombre: "dish_selected",
        viandaId: "'; drop table eventos_analitica; --",
      }),
    ).toBeNull();
  });

  it("dish_selected con viandaId válido se acepta y nunca lee vianderaId", () => {
    const resultado = sanitizarEvento({
      nombre: "dish_selected",
      vianderaId: UUID_VALIDO,
      viandaId: UUID_VALIDO_2,
    });
    expect(resultado?.viandaId).toBe(UUID_VALIDO_2);
    expect(resultado?.vianderaId).toBeUndefined();
  });

  it("whatsapp_intent sin vianderaId ni viandaId se rechaza por completo", () => {
    expect(sanitizarEvento({ nombre: "whatsapp_intent" })).toBeNull();
  });

  it("whatsapp_intent con ambos IDs inválidos se rechaza por completo", () => {
    expect(
      sanitizarEvento({
        nombre: "whatsapp_intent",
        vianderaId: "no-es-uuid",
        viandaId: "tampoco",
      }),
    ).toBeNull();
  });

  it("whatsapp_clicked sin vianderaId ni viandaId se rechaza por completo", () => {
    expect(sanitizarEvento({ nombre: "whatsapp_clicked" })).toBeNull();
  });

  it("whatsapp_intent con viandaId válido guarda solo viandaId y deriva con_plato=true", () => {
    const resultado = sanitizarEvento({
      nombre: "whatsapp_intent",
      vianderaId: UUID_VALIDO,
      viandaId: UUID_VALIDO_2,
    });
    expect(resultado?.viandaId).toBe(UUID_VALIDO_2);
    expect(resultado?.vianderaId).toBeUndefined();
    expect(resultado?.metadata?.con_plato).toBe(true);
  });

  it("whatsapp_clicked sin viandaId pero con vianderaId válido se acepta con con_plato=false", () => {
    const resultado = sanitizarEvento({
      nombre: "whatsapp_clicked",
      vianderaId: UUID_VALIDO,
    });
    expect(resultado?.vianderaId).toBe(UUID_VALIDO);
    expect(resultado?.viandaId).toBeUndefined();
    expect(resultado?.metadata?.con_plato).toBe(false);
  });

  it("whatsapp_clicked ignora un con_plato=true enviado por el cliente cuando no hay plato", () => {
    const resultado = sanitizarEvento({
      nombre: "whatsapp_clicked",
      vianderaId: UUID_VALIDO,
      metadata: { con_plato: true },
    });
    expect(resultado?.metadata?.con_plato).toBe(false);
  });

  it("whatsapp_intent ignora un con_plato=false enviado por el cliente cuando sí hay plato válido", () => {
    const resultado = sanitizarEvento({
      nombre: "whatsapp_intent",
      viandaId: UUID_VALIDO_2,
      metadata: { con_plato: false },
    });
    expect(resultado?.metadata?.con_plato).toBe(true);
  });
});

describe("sanitizarEvento — metadata: claves prohibidas", () => {
  it("elimina metadata sensible y conserva las claves permitidas", () => {
    expect(
      sanitizarEvento({
        nombre: "whatsapp_intent",
        viandaId: UUID_VALIDO_2,
        metadata: { telefono: "123", mensaje: "hola", origen: "perfil" },
      })?.metadata,
    ).toEqual({ origen: "perfil", con_plato: true });
  });

  it.each([
    "telefono",
    "phone",
    "direccion",
    "address",
    "nombre",
    "email",
    "mensaje",
    "message",
    "user_id",
  ])("descarta la clave prohibida %s", (clave) => {
    const metadata: Record<string, string> = {
      [clave]: "cualquier valor",
      origen: "explorar",
    };
    const resultado = sanitizarEvento({ nombre: "explore_viewed", metadata });
    expect(resultado?.metadata).toEqual({ origen: "explorar" });
  });
});

describe("sanitizarEvento — metadata: reglas por tipo de evento", () => {
  it("search_submitted acepta origen y busqueda_longitud", () => {
    const resultado = sanitizarEvento({
      nombre: "search_submitted",
      metadata: { origen: "explorar", busqueda_longitud: 12 },
    });
    expect(resultado?.metadata).toEqual({
      origen: "explorar",
      busqueda_longitud: 12,
    });
  });

  it("explore_viewed descarta busqueda_longitud aunque el valor sea válido", () => {
    const resultado = sanitizarEvento({
      nombre: "explore_viewed",
      metadata: { origen: "explorar", busqueda_longitud: 12 },
    });
    expect(resultado?.metadata).toEqual({ origen: "explorar" });
  });

  it("filter_applied acepta filtro, tipo_plato y modalidad", () => {
    const resultado = sanitizarEvento({
      nombre: "filter_applied",
      metadata: {
        origen: "explorar",
        filtro: "modalidad",
        tipo_plato: "cena",
        modalidad: "envio",
      },
    });
    expect(resultado?.metadata).toEqual({
      origen: "explorar",
      filtro: "modalidad",
      tipo_plato: "cena",
      modalidad: "envio",
    });
  });

  it("dish_selected descarta filtro y modalidad aunque el valor sea válido", () => {
    const resultado = sanitizarEvento({
      nombre: "dish_selected",
      viandaId: UUID_VALIDO_2,
      metadata: { origen: "explorar", filtro: "tipo", modalidad: "retiro" },
    });
    expect(resultado?.metadata).toEqual({ origen: "explorar" });
  });

  it("descarta una clave desconocida aunque el valor sea válido", () => {
    const resultado = sanitizarEvento({
      nombre: "explore_viewed",
      metadata: { origen: "explorar", categoria: "casera" },
    });
    expect(resultado?.metadata).toEqual({ origen: "explorar" });
  });

  it("descarta texto libre en un campo enumerado", () => {
    const resultado = sanitizarEvento({
      nombre: "explore_viewed",
      metadata: { origen: "cualquier cosa que escriba el usuario" },
    });
    expect(resultado?.metadata).toBeUndefined();
  });

  it("descarta busqueda_longitud fuera de rango, no entera o de otro tipo", () => {
    const casos = [-1, 81, 12.5, "12"];
    for (const valor of casos) {
      expect(
        sanitizarEvento({
          nombre: "search_submitted",
          metadata: { busqueda_longitud: valor },
        })?.metadata,
      ).toBeUndefined();
    }
  });

  it("no incluye metadata cuando queda vacía después de sanitizar (evento no-WhatsApp)", () => {
    expect(
      sanitizarEvento({ nombre: "explore_viewed", metadata: {} })?.metadata,
    ).toBeUndefined();
  });
});

describe("registrarEvento", () => {
  beforeEach(() => {
    mockedCreateAdminClient.mockReset();
  });

  it("inserta el evento sanitizado usando el cliente admin", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedCreateAdminClient.mockReturnValue({ from } as any);

    await registrarEvento({
      nombre: "profile_viewed",
      vianderaId: UUID_VALIDO,
      metadata: { origen: "perfil", telefono: "no-deberia-viajar" },
    });

    expect(from).toHaveBeenCalledWith("eventos_analitica");
    expect(insert).toHaveBeenCalledWith({
      nombre: "profile_viewed",
      viandera_id: UUID_VALIDO,
      metadata: { origen: "perfil" },
    });
  });

  it.each([
    { caso: "nombre inválido", entrada: { nombre: "evento_inventado" } },
    { caso: "sin ID requerido", entrada: { nombre: "profile_viewed" } },
    { caso: "ID requerido inválido", entrada: { nombre: "dish_selected", viandaId: "no-uuid" } },
    { caso: "null", entrada: null },
    { caso: "undefined", entrada: undefined },
    { caso: "array", entrada: ["explore_viewed"] },
    { caso: "string", entrada: "explore_viewed" },
    { caso: "número", entrada: 42 },
    { caso: "Date", entrada: new Date() },
    { caso: "Map", entrada: new Map([["nombre", "explore_viewed"]]) },
  ])(
    "un rechazo esperado ($caso) no crea el cliente admin, no inserta y no loguea",
    async ({ entrada }) => {
      const insert = vi.fn();
      const from = vi.fn().mockReturnValue({ insert });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedCreateAdminClient.mockReturnValue({ from } as any);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(registrarEvento(entrada)).resolves.toBeUndefined();

      expect(mockedCreateAdminClient).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    },
  );

  it("un fallo real de Supabase se captura y se loguea sin romper el recorrido", async () => {
    const insert = vi
      .fn()
      .mockResolvedValue({ error: new Error("fallo de red") });
    const from = vi.fn().mockReturnValue({ insert });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedCreateAdminClient.mockReturnValue({ from } as any);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      registrarEvento({ nombre: "explore_viewed" }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("un fallo inesperado al crear el cliente admin se captura y se loguea", async () => {
    mockedCreateAdminClient.mockImplementation(() => {
      throw new Error("sin credenciales");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      registrarEvento({ nombre: "explore_viewed" }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
