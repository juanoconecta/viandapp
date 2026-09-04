import { describe, expect, it } from "vitest";
import { costoEnvioVigente, modalidadesDisponibles } from "./modalidades";

const vianderaBase = {
  ofrece_retiro: false,
  ofrece_envio: false,
  costo_envio_propio: null as number | null,
};

describe("modalidadesDisponibles", () => {
  it("incluye retiro solo si ofrece_retiro", () => {
    expect(modalidadesDisponibles({ ...vianderaBase, ofrece_retiro: true }, null)).toContain(
      "retiro",
    );
    expect(modalidadesDisponibles(vianderaBase, null)).not.toContain("retiro");
  });

  it("requiere ofrece_envio y un costo no nulo para envio propio", () => {
    expect(
      modalidadesDisponibles(
        { ...vianderaBase, ofrece_envio: true, costo_envio_propio: 600 },
        null,
      ),
    ).toContain("envio_propio");
    expect(
      modalidadesDisponibles({ ...vianderaBase, ofrece_envio: true }, null),
    ).not.toContain("envio_propio");
  });

  it("admite costo cero como envio propio gratis explicito", () => {
    expect(
      modalidadesDisponibles(
        { ...vianderaBase, ofrece_envio: true, costo_envio_propio: 0 },
        null,
      ),
    ).toContain("envio_propio");
  });

  it("requiere adhesion aprobada y costo cargado para envio Puni", () => {
    expect(
      modalidadesDisponibles(vianderaBase, {
        estado: "aprobada",
        costo_envio_puni: 500,
      }),
    ).toContain("envio_puni");
    expect(
      modalidadesDisponibles(vianderaBase, {
        estado: "aprobada",
        costo_envio_puni: null,
      }),
    ).not.toContain("envio_puni");
    expect(
      modalidadesDisponibles(vianderaBase, {
        estado: "pendiente",
        costo_envio_puni: 500,
      }),
    ).not.toContain("envio_puni");
  });

  it("devuelve un array vacio si no hay modalidades utilizables", () => {
    expect(modalidadesDisponibles(vianderaBase, null)).toEqual([]);
  });
});

describe("costoEnvioVigente", () => {
  it("devuelve cero para retiro", () => {
    expect(costoEnvioVigente("retiro", vianderaBase, null)).toBe(0);
  });

  it("devuelve el costo propio, incluido null", () => {
    expect(
      costoEnvioVigente(
        "envio_propio",
        { ...vianderaBase, costo_envio_propio: 600 },
        null,
      ),
    ).toBe(600);
    expect(costoEnvioVigente("envio_propio", vianderaBase, null)).toBeNull();
  });

  it("devuelve el costo Puni cargado por la viandera, incluido null", () => {
    expect(
      costoEnvioVigente("envio_puni", vianderaBase, {
        estado: "aprobada",
        costo_envio_puni: 700,
      }),
    ).toBe(700);
    expect(
      costoEnvioVigente("envio_puni", vianderaBase, {
        estado: "aprobada",
        costo_envio_puni: null,
      }),
    ).toBeNull();
  });
});
