import { describe, expect, it, vi } from "vitest";
import {
  esSlugReservado,
  generarSlugDisponible,
  normalizarSlug,
} from "./slug";

describe("normalizarSlug", () => {
  it("pasa a minúsculas", () => {
    expect(normalizarSlug("Doña Rosa")).toBe("dona-rosa");
  });

  it("quita acentos y diacríticos", () => {
    expect(normalizarSlug("Cocina Árbol Feliz")).toBe("cocina-arbol-feliz");
  });

  it("reemplaza espacios y símbolos por guiones", () => {
    expect(normalizarSlug("Viandas & Algo Más!!")).toBe("viandas-algo-mas");
  });

  it("colapsa guiones repetidos en uno solo", () => {
    expect(normalizarSlug("Cocina   de   Mabel")).toBe("cocina-de-mabel");
  });

  it("recorta guiones al principio y al final", () => {
    expect(normalizarSlug("  -Alma Cocina- ")).toBe("alma-cocina");
  });

  it("devuelve string vacío si no queda nada normalizable", () => {
    expect(normalizarSlug("¡¡¡ !!!")).toBe("");
  });
});

describe("esSlugReservado", () => {
  it("reconoce las rutas reservadas existentes", () => {
    expect(esSlugReservado("admin")).toBe(true);
    expect(esSlugReservado("viandera")).toBe(true);
    expect(esSlugReservado("app")).toBe(true);
  });

  it("reconoce 'explorar' como reservada", () => {
    expect(esSlugReservado("explorar")).toBe(true);
  });

  it("no marca como reservado un slug real de viandera", () => {
    expect(esSlugReservado("dona-rosa")).toBe(false);
  });
});

type FilaVianderaFalsa = { slug: string; id: string };

function crearSupabaseFalso(filas: FilaVianderaFalsa[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_columna: string, slugBuscado: string) => {
          const coincidencias = filas.filter((f) => f.slug === slugBuscado);
          return {
            neq: vi.fn((_col: string, idExcluido: string) => ({
              maybeSingle: async () => ({
                data: coincidencias.find((f) => f.id !== idExcluido) ?? null,
              }),
            })),
            maybeSingle: async () => ({
              data: coincidencias[0] ?? null,
            }),
          };
        }),
      })),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("generarSlugDisponible", () => {
  it("devuelve el slug normalizado cuando está libre", async () => {
    const supabase = crearSupabaseFalso([]);
    expect(await generarSlugDisponible(supabase, "Doña Rosa")).toBe(
      "dona-rosa",
    );
  });

  it("agrega un sufijo numérico cuando el slug ya está en uso", async () => {
    const supabase = crearSupabaseFalso([
      { slug: "dona-rosa", id: "otra-fila" },
    ]);
    expect(await generarSlugDisponible(supabase, "Doña Rosa")).toBe(
      "dona-rosa-2",
    );
  });

  it("salta 'explorar' aunque sea el nombre normalizado, por estar reservado", async () => {
    const supabase = crearSupabaseFalso([]);
    expect(await generarSlugDisponible(supabase, "Explorar")).toBe(
      "explorar-2",
    );
  });

  it("usa 'cocina' como base cuando el nombre no deja nada normalizable", async () => {
    const supabase = crearSupabaseFalso([]);
    expect(await generarSlugDisponible(supabase, "¡¡¡ !!!")).toBe("cocina");
  });

  it("excluye la propia fila al revisar colisiones (autoguardado sin cambios)", async () => {
    const supabase = crearSupabaseFalso([
      { slug: "dona-rosa", id: "id-propio" },
    ]);
    expect(
      await generarSlugDisponible(supabase, "Doña Rosa", "id-propio"),
    ).toBe("dona-rosa");
  });

  it("no excluye una fila ajena que sí colisiona", async () => {
    const supabase = crearSupabaseFalso([
      { slug: "dona-rosa", id: "fila-de-otra-viandera" },
    ]);
    expect(
      await generarSlugDisponible(supabase, "Doña Rosa", "id-propio"),
    ).toBe("dona-rosa-2");
  });
});
