import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FilterChips from "./FilterChips";

const filtros = {
  q: "milanesa",
  tipo: "cena" as const,
  etiqueta: "vegetariano",
  modalidad: "envio" as const,
};

describe("FilterChips", () => {
  it("separa los filtros de comida de la modalidad de entrega", () => {
    const html = renderToStaticMarkup(createElement(FilterChips, { filtros }));

    const grupoComida = html.match(
      /<section[^>]*aria-labelledby="filtros-comida"[\s\S]*?<\/section>/,
    )?.[0];
    const grupoEntrega = html.match(
      /<section[^>]*aria-labelledby="filtros-entrega"[\s\S]*?<\/section>/,
    )?.[0];

    expect(grupoComida).toContain("Almuerzo");
    expect(grupoComida).toContain("Cena");
    expect(grupoComida).not.toContain("Retiro");
    expect(grupoComida).not.toContain("Envío");
    expect(grupoEntrega).toContain("¿Cómo querés recibirlo?");
    expect(grupoEntrega).toContain("Cualquiera");
    expect(grupoEntrega).toContain("Retiro");
    expect(grupoEntrega).toContain("Envío");
  });

  it("la opción Cualquiera limpia solo la modalidad", () => {
    const html = renderToStaticMarkup(createElement(FilterChips, { filtros }));

    expect(html).toContain(
      'href="/explorar?q=milanesa&amp;tipo=cena&amp;etiqueta=vegetariano"',
    );
  });

  it("permite quitar una modalidad volviendo a tocar la opción activa", () => {
    const html = renderToStaticMarkup(createElement(FilterChips, { filtros }));

    expect(html).toMatch(
      /href="\/explorar\?q=milanesa&amp;tipo=cena&amp;etiqueta=vegetariano"[^>]*>Envío/,
    );
  });
});
