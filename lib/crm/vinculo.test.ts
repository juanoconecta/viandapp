import { describe, expect, it } from "vitest";
import { validarVinculo, type DatosVinculo } from "./vinculo";

describe("validarVinculo", () => {
  it("acepta un vianderaId", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      vianderaId: "uuid-viandera-1",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(true);
  });

  it("acepta un interesadoId", () => {
    const datos: DatosVinculo = {
      tipo: "cocina_potencial",
      interesadoId: "uuid-interesado-1",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(true);
  });

  it("acepta nombreLibre", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      nombreLibre: "Juan García",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(true);
  });

  it("rechaza dos FK simultáneas", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      vianderaId: "uuid-viandera-1",
      interesadoId: "uuid-interesado-1",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/mismo tiempo|viandera y a una interesada/i);
    }
  });

  it("rechaza fila libre sin nombre", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      // No vianderaId, no interesadoId, no nombreLibre, no piiEliminada
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/nombre|vínculo/i);
    }
  });

  it("acepta nombreLibre en cadena vacía como vínculo válido (SQL: '' IS NOT NULL)", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      nombreLibre: "",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(true);
  });

  it("acepta fila anónima solo si tipo === 'consumidor', sin FK, sin nombre/contacto y con consentimiento retirado", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(true);
  });

  it("rechaza fila anónima si tipo no es 'consumidor'", () => {
    const datos: DatosVinculo = {
      tipo: "cocina_activa",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/consumidor|anón/i);
    }
  });

  it("rechaza fila anónima si tiene vianderaId", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      vianderaId: "uuid-viandera-1",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/anonimizado|no puede|viandera/i);
    }
  });

  it("rechaza fila anónima si tiene interesadoId", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      interesadoId: "uuid-interesado-1",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/anonimizado|no puede|interesado/i);
    }
  });

  it("rechaza fila anónima si tiene nombreLibre", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      nombreLibre: "Juan García",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/anonimizado|no puede|nombre/i);
    }
  });

  it("rechaza fila anónima si tiene contactoLibre", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      contactoLibre: "juan@example.com",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/anonimizado|no puede|contacto/i);
    }
  });

  it("rechaza fila anónima sin consentimiento retirado", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      piiEliminada: true,
      // No consentimientoRetiradoEn
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/consentimiento|retirado/i);
    }
  });

  it("rechaza fila anónima si contactoLibre es cadena vacía (SQL: '' no es IS NULL)", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      contactoLibre: "",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
  });

  it("rechaza fila anónima si nombreLibre es cadena vacía (SQL: '' no es IS NULL)", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      nombreLibre: "",
      piiEliminada: true,
      consentimientoRetiradoEn: "2026-09-10T00:00:00Z",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
  });

  it("acepta row con vianderaId y contactoLibre (FK principal + datos de contacto adicionales)", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      vianderaId: "uuid-viandera-1",
      contactoLibre: "juan@example.com",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(true);
  });

  it("rechaza contactoLibre solo, sin FK/nombreLibre/piiEliminada (no es un vínculo válido)", () => {
    const datos: DatosVinculo = {
      tipo: "consumidor",
      contactoLibre: "juan@example.com",
    };
    const resultado = validarVinculo(datos);
    expect(resultado.ok).toBe(false);
  });
});
