import { describe, expect, it } from "vitest";
import { parsearFiltros } from "./filtros";

describe("parsearFiltros", () => {
  it("devuelve filtros seguros por defecto", () => {
    expect(parsearFiltros({})).toEqual({
      q: "",
      tipo: "todos",
      etiqueta: null,
      modalidad: "todas",
    });
  });

  it("descarta valores no permitidos", () => {
    expect(
      parsearFiltros({ tipo: "otro", etiqueta: "inventada", modalidad: "dron" }),
    ).toEqual({ q: "", tipo: "todos", etiqueta: null, modalidad: "todas" });
  });

  it("toma solo el primer valor cuando llega un array malicioso", () => {
    expect(
      parsearFiltros({
        q: ["milanesa", "otra cosa"],
        tipo: ["almuerzo", "cena"],
        etiqueta: ["vegano", "vegetariano"],
        modalidad: ["retiro", "envio"],
      }),
    ).toEqual({
      q: "milanesa",
      tipo: "almuerzo",
      etiqueta: "vegano",
      modalidad: "retiro",
    });
  });

  it("recorta espacios en el término de búsqueda", () => {
    expect(parsearFiltros({ q: "  milanesa con puré  " })).toEqual({
      q: "milanesa con puré",
      tipo: "todos",
      etiqueta: null,
      modalidad: "todas",
    });
  });

  it("limita el término de búsqueda a 80 caracteres", () => {
    const largo = "a".repeat(120);
    const resultado = parsearFiltros({ q: largo });
    expect(resultado.q).toBe("a".repeat(80));
    expect(resultado.q.length).toBe(80);
  });

  it("recorta a 80 caracteres después de aplicar trim", () => {
    const largoConEspacios = `  ${"b".repeat(90)}  `;
    const resultado = parsearFiltros({ q: largoConEspacios });
    expect(resultado.q).toBe("b".repeat(80));
  });

  it("acepta los valores válidos de tipo", () => {
    expect(parsearFiltros({ tipo: "almuerzo" }).tipo).toBe("almuerzo");
    expect(parsearFiltros({ tipo: "cena" }).tipo).toBe("cena");
    expect(parsearFiltros({ tipo: "todos" }).tipo).toBe("todos");
  });

  it("descarta un tipo inválido y vuelve a todos", () => {
    expect(parsearFiltros({ tipo: "desayuno" }).tipo).toBe("todos");
  });

  it("acepta una etiqueta dietaria válida", () => {
    expect(parsearFiltros({ etiqueta: "vegano" }).etiqueta).toBe("vegano");
    expect(parsearFiltros({ etiqueta: "sin-tacc" }).etiqueta).toBe("sin-tacc");
  });

  it("descarta una etiqueta fuera de ETIQUETAS_DIETARIAS", () => {
    expect(parsearFiltros({ etiqueta: "no-existe" }).etiqueta).toBeNull();
  });

  it("acepta los valores válidos de modalidad", () => {
    expect(parsearFiltros({ modalidad: "retiro" }).modalidad).toBe("retiro");
    expect(parsearFiltros({ modalidad: "envio" }).modalidad).toBe("envio");
    expect(parsearFiltros({ modalidad: "todas" }).modalidad).toBe("todas");
  });

  it("descarta una modalidad inválida y vuelve a todas", () => {
    expect(parsearFiltros({ modalidad: "dron" }).modalidad).toBe("todas");
  });

  it("descarta un array vacío como si no hubiera valor", () => {
    expect(parsearFiltros({ q: [], tipo: [] })).toEqual({
      q: "",
      tipo: "todos",
      etiqueta: null,
      modalidad: "todas",
    });
  });
});
