import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstadoConsentimiento } from "./EstadoConsentimiento";

// Sin JSX acá a propósito: vitest.config.mts solo incluye `**/*.test.ts`
// (mismo motivo por el que components/carrito/CarritoUI.test.ts, que
// también prueba componentes .tsx vía renderToStaticMarkup, usa
// createElement en vez de sintaxis JSX y queda como .test.ts en vez de
// .test.tsx).
describe("EstadoConsentimiento", () => {
  it("muestra 'Consentimiento vigente' para un consumidor sin retiro ni anonimización", () => {
    const html = renderToStaticMarkup(
      createElement(EstadoConsentimiento, {
        tipo: "consumidor",
        piiEliminada: false,
        consentimientoRetiradoEn: null,
      }),
    );

    expect(html).toContain("Consentimiento vigente");
  });

  it("muestra 'Consentimiento retirado' cuando hay fecha de retiro y no está anonimizado", () => {
    const html = renderToStaticMarkup(
      createElement(EstadoConsentimiento, {
        tipo: "consumidor",
        piiEliminada: false,
        consentimientoRetiradoEn: "2026-09-01T00:00:00.000Z",
      }),
    );

    expect(html).toContain("Consentimiento retirado");
    expect(html).not.toContain("Consentimiento vigente");
  });

  it("muestra 'Datos anonimizados' cuando piiEliminada es true, incluso con fecha de retiro", () => {
    const html = renderToStaticMarkup(
      createElement(EstadoConsentimiento, {
        tipo: "consumidor",
        piiEliminada: true,
        consentimientoRetiradoEn: "2026-09-01T00:00:00.000Z",
      }),
    );

    expect(html).toContain("Datos anonimizados");
    expect(html).not.toContain("Consentimiento retirado");
    expect(html).not.toContain("Consentimiento vigente");
  });

  it("no muestra controles de consumidor para tipos que no son consumidor", () => {
    for (const tipo of ["cocina_activa", "aliado_estrategico"] as const) {
      const html = renderToStaticMarkup(
        createElement(EstadoConsentimiento, {
          tipo,
          piiEliminada: false,
          consentimientoRetiradoEn: null,
        }),
      );

      expect(html).toBe("");
    }
  });
});
