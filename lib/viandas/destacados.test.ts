import { describe, expect, it } from "vitest";
import { clasificarDestacados } from "./destacados";
import type { ResultadoPlato } from "./consultas";

function platoFalso(id: string): ResultadoPlato {
  return {
    id,
    nombre: `Plato ${id}`,
    descripcion: null,
    precio: 1000,
    tipo: "almuerzo",
    fotoUrl: null,
    etiquetas: [],
    viandera: {
      nombre: "Cocina de prueba",
      slug: "cocina-de-prueba",
      barrio: null,
      ofreceRetiro: true,
      ofreceEnvio: false,
    },
  };
}

describe("clasificarDestacados", () => {
  it("devuelve 'resultado' con los platos recortados al límite", async () => {
    const platos = [platoFalso("1"), platoFalso("2"), platoFalso("3")];
    const resultado = await clasificarDestacados(async () => platos, 2);
    expect(resultado).toEqual({ estado: "resultado", platos: platos.slice(0, 2) });
  });

  it("no recorta si hay menos platos que el límite", async () => {
    const platos = [platoFalso("1")];
    const resultado = await clasificarDestacados(async () => platos, 8);
    expect(resultado).toEqual({ estado: "resultado", platos });
  });

  it("devuelve 'vacio' cuando la búsqueda resuelve sin platos", async () => {
    const resultado = await clasificarDestacados(async () => [], 8);
    expect(resultado).toEqual({ estado: "vacio" });
  });

  it("devuelve 'error' cuando la búsqueda rechaza", async () => {
    const resultado = await clasificarDestacados(async () => {
      throw new Error("fallo simulado");
    }, 8);
    expect(resultado).toEqual({ estado: "error" });
  });
});
