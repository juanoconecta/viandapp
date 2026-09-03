import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "../supabase/server";
import {
  buscarPlatos,
  escaparIlike,
  tiposParaFiltro,
} from "./consultas";
import type { FiltrosExplorador } from "./filtros";

const mockedCreateClient = vi.mocked(createClient);

const FILTROS_BASE: FiltrosExplorador = {
  q: "",
  tipo: "todos",
  etiqueta: null,
  modalidad: "todas",
};

const VIANDERA_FILA = {
  id: "v1",
  nombre: "Doña Rosa",
  slug: "dona-rosa",
  barrio: "Centro",
  ofrece_retiro: true,
  ofrece_envio: false,
};

const PLATO_FILA = {
  id: "p1",
  vianderas_id: "v1",
  nombre: "Milanesa con puré",
  descripcion: null,
  precio: 4200,
  tipo: "almuerzo" as const,
  foto_url: null,
  etiquetas: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function crearQueryFalsa(resultado: { data: any; error: any }) {
  const llamadas: Record<string, unknown[][]> = {};
  const registrar = (metodo: string, args: unknown[]) => {
    (llamadas[metodo] ??= []).push(args);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {
    llamadas,
    select: vi.fn((...args: unknown[]) => {
      registrar("select", args);
      return query;
    }),
    eq: vi.fn((...args: unknown[]) => {
      registrar("eq", args);
      return query;
    }),
    in: vi.fn((...args: unknown[]) => {
      registrar("in", args);
      return query;
    }),
    contains: vi.fn((...args: unknown[]) => {
      registrar("contains", args);
      return query;
    }),
    ilike: vi.fn((...args: unknown[]) => {
      registrar("ilike", args);
      return query;
    }),
    order: vi.fn((...args: unknown[]) => {
      registrar("order", args);
      return query;
    }),
    limit: vi.fn((...args: unknown[]) => {
      registrar("limit", args);
      return query;
    }),
    then: (
      resolve: (value: typeof resultado) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(resultado).then(resolve, reject),
  };

  return query;
}

function mockearSupabase({
  vianderas,
  viandas,
}: {
  vianderas: { data: unknown; error: unknown };
  viandas?: { data: unknown; error: unknown };
}) {
  const queryVianderas = crearQueryFalsa(vianderas);
  const queryViandas = viandas ? crearQueryFalsa(viandas) : null;

  const from = vi.fn((tabla: string) => {
    if (tabla === "vianderas") return queryVianderas;
    if (tabla === "viandas" && queryViandas) return queryViandas;
    throw new Error(`tabla inesperada en el mock: ${tabla}`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockedCreateClient.mockResolvedValue({ from } as any);

  return { queryVianderas, queryViandas };
}

describe("escaparIlike", () => {
  it("no modifica texto sin caracteres especiales", () => {
    expect(escaparIlike("milanesa")).toBe("milanesa");
  });

  it("escapa %", () => {
    expect(escaparIlike("100%")).toBe("100\\%");
  });

  it("escapa _", () => {
    expect(escaparIlike("plato_especial")).toBe("plato\\_especial");
  });

  it("escapa \\ antes que los demás, sin duplicar las barras nuevas", () => {
    expect(escaparIlike("a\\b")).toBe("a\\\\b");
    expect(escaparIlike("a\\%b_c")).toBe("a\\\\\\%b\\_c");
  });

  it("un texto que es solo '%' no queda como comodín universal", () => {
    expect(escaparIlike("%")).toBe("\\%");
  });

  it("un texto que es solo '_' no queda como comodín de un carácter", () => {
    expect(escaparIlike("_")).toBe("\\_");
  });
});

describe("tiposParaFiltro", () => {
  it("devuelve null para 'todos' (sin filtro)", () => {
    expect(tiposParaFiltro("todos")).toBeNull();
  });

  it("incluye 'ambos' junto con 'almuerzo'", () => {
    expect(tiposParaFiltro("almuerzo")).toEqual(["almuerzo", "ambos"]);
  });

  it("incluye 'ambos' junto con 'cena'", () => {
    expect(tiposParaFiltro("cena")).toEqual(["cena", "ambos"]);
  });
});

describe("buscarPlatos", () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
  });

  it("devuelve los platos mapeados cuando ambas consultas resuelven bien", async () => {
    mockearSupabase({
      vianderas: { data: [VIANDERA_FILA], error: null },
      viandas: { data: [PLATO_FILA], error: null },
    });

    const resultado = await buscarPlatos(FILTROS_BASE);

    expect(resultado).toEqual([
      {
        id: "p1",
        nombre: "Milanesa con puré",
        descripcion: null,
        precio: 4200,
        tipo: "almuerzo",
        fotoUrl: null,
        etiquetas: [],
        viandera: {
          nombre: "Doña Rosa",
          slug: "dona-rosa",
          barrio: "Centro",
          ofreceRetiro: true,
          ofreceEnvio: false,
        },
      },
    ]);
  });

  it("devuelve [] cuando no hay vianderas activas — resultado vacío legítimo", async () => {
    mockearSupabase({ vianderas: { data: [], error: null } });
    await expect(buscarPlatos(FILTROS_BASE)).resolves.toEqual([]);
  });

  it("devuelve [] cuando no hay platos que coincidan — resultado vacío legítimo", async () => {
    mockearSupabase({
      vianderas: { data: [VIANDERA_FILA], error: null },
      viandas: { data: [], error: null },
    });
    await expect(buscarPlatos(FILTROS_BASE)).resolves.toEqual([]);
  });

  it("lanza (no devuelve []) cuando falla la consulta de vianderas", async () => {
    mockearSupabase({
      vianderas: { data: null, error: { message: "detalle interno sensible" } },
    });

    await expect(buscarPlatos(FILTROS_BASE)).rejects.toThrow(
      "No pudimos cargar las viandas disponibles.",
    );
  });

  it("el error lanzado no expone el detalle interno de Supabase", async () => {
    mockearSupabase({
      vianderas: {
        data: null,
        error: { message: "relation vianderas.barrio does not exist" },
      },
    });

    await expect(buscarPlatos(FILTROS_BASE)).rejects.not.toThrow(
      /does not exist/,
    );
  });

  it("lanza (no devuelve []) cuando falla la consulta de viandas", async () => {
    mockearSupabase({
      vianderas: { data: [VIANDERA_FILA], error: null },
      viandas: { data: null, error: { message: "fallo de red" } },
    });

    await expect(buscarPlatos(FILTROS_BASE)).rejects.toThrow(
      "No pudimos cargar las viandas disponibles.",
    );
  });

  it("filtra por tipo incluyendo 'ambos' junto al tipo elegido", async () => {
    const { queryViandas } = mockearSupabase({
      vianderas: { data: [VIANDERA_FILA], error: null },
      viandas: { data: [PLATO_FILA], error: null },
    });

    await buscarPlatos({ ...FILTROS_BASE, tipo: "almuerzo" });

    expect(queryViandas!.llamadas.in).toContainEqual([
      "tipo",
      ["almuerzo", "ambos"],
    ]);
  });

  it("no filtra por tipo cuando es 'todos'", async () => {
    const { queryViandas } = mockearSupabase({
      vianderas: { data: [VIANDERA_FILA], error: null },
      viandas: { data: [PLATO_FILA], error: null },
    });

    await buscarPlatos(FILTROS_BASE);

    const llamadasTipo = (queryViandas!.llamadas.in ?? []).filter(
      ([columna]: unknown[]) => columna === "tipo",
    );
    expect(llamadasTipo).toHaveLength(0);
  });

  it("escapa el término de búsqueda antes de armar el patrón ILIKE", async () => {
    const { queryViandas } = mockearSupabase({
      vianderas: { data: [VIANDERA_FILA], error: null },
      viandas: { data: [PLATO_FILA], error: null },
    });

    await buscarPlatos({ ...FILTROS_BASE, q: "100%_off" });

    expect(queryViandas!.llamadas.ilike).toContainEqual([
      "nombre",
      "%100\\%\\_off%",
    ]);
  });
});
