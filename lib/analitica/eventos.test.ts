import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "../supabase/admin";
import { registrarEvento, sanitizarEvento } from "./eventos";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

const UUID_VALIDO = "550e8400-e29b-41d4-a716-446655440000";
const UUID_VALIDO_2 = "6b1f6f2e-0a2e-4d3b-9a3d-2b6a9f7d1c4a";

const NOMBRES_VALIDOS = [
  "explore_viewed",
  "search_submitted",
  "filter_applied",
  "profile_viewed",
  "dish_selected",
  "whatsapp_intent",
  "whatsapp_clicked",
] as const;

describe("sanitizarEvento", () => {
  it("elimina metadata sensible y conserva las claves permitidas", () => {
    expect(
      sanitizarEvento({
        nombre: "whatsapp_intent",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: { telefono: "123", mensaje: "hola", origen: "perfil" } as any,
      }).metadata,
    ).toEqual({ origen: "perfil" });
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
    const resultado = sanitizarEvento({
      nombre: "explore_viewed",
      metadata,
    });
    expect(resultado.metadata).toEqual({ origen: "explorar" });
  });

  it("acepta los siete nombres de evento definidos", () => {
    for (const nombre of NOMBRES_VALIDOS) {
      expect(sanitizarEvento({ nombre }).nombre).toBe(nombre);
    }
  });

  it("rechaza un nombre de evento fuera de la lista", () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sanitizarEvento({ nombre: "evento_inventado" as any }),
    ).toThrow();
  });

  it("conserva un vianderaId con formato UUID válido", () => {
    expect(
      sanitizarEvento({ nombre: "profile_viewed", vianderaId: UUID_VALIDO })
        .vianderaId,
    ).toBe(UUID_VALIDO);
  });

  it("descarta un vianderaId que no es UUID, sin lanzar error", () => {
    let resultado: ReturnType<typeof sanitizarEvento> | undefined;
    expect(() => {
      resultado = sanitizarEvento({
        nombre: "profile_viewed",
        vianderaId: "no-es-un-uuid",
      });
    }).not.toThrow();
    expect(resultado?.vianderaId).toBeUndefined();
  });

  it("descarta un viandaId con intento de inyección, sin lanzar error", () => {
    const resultado = sanitizarEvento({
      nombre: "dish_selected",
      viandaId: "'; drop table eventos_analitica; --",
    });
    expect(resultado.viandaId).toBeUndefined();
  });

  it("conserva un viandaId con formato UUID válido", () => {
    expect(
      sanitizarEvento({ nombre: "dish_selected", viandaId: UUID_VALIDO_2 })
        .viandaId,
    ).toBe(UUID_VALIDO_2);
  });

  it("acepta las seis claves de metadata conocidas con valores válidos", () => {
    const resultado = sanitizarEvento({
      nombre: "filter_applied",
      metadata: {
        origen: "explorar",
        busqueda_longitud: 12,
        filtro: "modalidad",
        tipo_plato: "cena",
        modalidad: "envio",
        con_plato: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    expect(resultado.metadata).toEqual({
      origen: "explorar",
      busqueda_longitud: 12,
      filtro: "modalidad",
      tipo_plato: "cena",
      modalidad: "envio",
      con_plato: true,
    });
  });

  it("descarta una clave desconocida aunque el valor sea válido", () => {
    const resultado = sanitizarEvento({
      nombre: "explore_viewed",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: { origen: "explorar", categoria: "casera" } as any,
    });
    expect(resultado.metadata).toEqual({ origen: "explorar" });
  });

  it("descarta texto libre en un campo enumerado", () => {
    const resultado = sanitizarEvento({
      nombre: "explore_viewed",
      metadata: { origen: "cualquier cosa que escriba el usuario" },
    });
    expect(resultado.metadata).toBeUndefined();
  });

  it("descarta busqueda_longitud fuera de rango, no entera o de otro tipo", () => {
    const casos = [-1, 81, 12.5, "12"];
    for (const valor of casos) {
      expect(
        sanitizarEvento({
          nombre: "search_submitted",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metadata: { busqueda_longitud: valor } as any,
        }).metadata,
      ).toBeUndefined();
    }
  });

  it("descarta con_plato si no es booleano", () => {
    expect(
      sanitizarEvento({
        nombre: "whatsapp_intent",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: { con_plato: "si" } as any,
      }).metadata,
    ).toBeUndefined();
  });

  it("no incluye metadata cuando queda vacía después de sanitizar", () => {
    expect(
      sanitizarEvento({ nombre: "explore_viewed", metadata: {} }).metadata,
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
      nombre: "whatsapp_clicked",
      vianderaId: UUID_VALIDO,
      metadata: { origen: "perfil", telefono: "no-deberia-viajar" },
    });

    expect(from).toHaveBeenCalledWith("eventos_analitica");
    expect(insert).toHaveBeenCalledWith({
      nombre: "whatsapp_clicked",
      viandera_id: UUID_VALIDO,
      metadata: { origen: "perfil" },
    });
  });

  it("no lanza error cuando Supabase devuelve un error", async () => {
    const insert = vi
      .fn()
      .mockResolvedValue({ error: new Error("fallo de red") });
    const from = vi.fn().mockReturnValue({ insert });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedCreateAdminClient.mockReturnValue({ from } as any);

    await expect(
      registrarEvento({ nombre: "explore_viewed" }),
    ).resolves.toBeUndefined();
  });

  it("no lanza error cuando el nombre del evento es inválido", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registrarEvento({ nombre: "evento_inventado" as any }),
    ).resolves.toBeUndefined();
  });

  it("no lanza error cuando createAdminClient falla", async () => {
    mockedCreateAdminClient.mockImplementation(() => {
      throw new Error("sin credenciales");
    });

    await expect(
      registrarEvento({ nombre: "explore_viewed" }),
    ).resolves.toBeUndefined();
  });
});
