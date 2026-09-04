import { describe, expect, it } from "vitest";
import { transicionValida } from "./transiciones";

describe("transicionValida", () => {
  it("permite pendiente -> aprobada solo para admin", () => {
    expect(transicionValida("pendiente", "aprobada", "admin")).toBe(true);
    expect(transicionValida("pendiente", "aprobada", "viandera")).toBe(false);
  });

  it("permite pendiente -> rechazada solo para admin", () => {
    expect(transicionValida("pendiente", "rechazada", "admin")).toBe(true);
    expect(transicionValida("pendiente", "rechazada", "viandera")).toBe(false);
  });

  it("permite suspender o revocar una adhesion aprobada solo al admin", () => {
    expect(transicionValida("aprobada", "suspendida", "admin")).toBe(true);
    expect(transicionValida("aprobada", "revocada", "admin")).toBe(true);
    expect(transicionValida("aprobada", "suspendida", "viandera")).toBe(false);
  });

  it("permite reactivar o revocar una adhesion suspendida solo al admin", () => {
    expect(transicionValida("suspendida", "aprobada", "admin")).toBe(true);
    expect(transicionValida("suspendida", "revocada", "admin")).toBe(true);
    expect(transicionValida("suspendida", "aprobada", "viandera")).toBe(false);
  });

  it("permite volver a solicitar una adhesion rechazada o revocada solo a la viandera", () => {
    expect(transicionValida("rechazada", "pendiente", "viandera")).toBe(true);
    expect(transicionValida("revocada", "pendiente", "viandera")).toBe(true);
    expect(transicionValida("rechazada", "pendiente", "admin")).toBe(false);
  });

  it("rechaza cualquier transicion no listada", () => {
    expect(transicionValida("pendiente", "suspendida", "admin")).toBe(false);
    expect(transicionValida("aprobada", "pendiente", "admin")).toBe(false);
    expect(transicionValida("aprobada", "aprobada", "admin")).toBe(false);
  });
});
