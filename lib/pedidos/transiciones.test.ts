import { describe, expect, it } from "vitest";
import { transicionValidaPedido } from "./transiciones";

describe("transicionValidaPedido", () => {
  it("permite generado -> confirmado", () => {
    expect(transicionValidaPedido("generado", "confirmado")).toBe(true);
  });

  it("permite generado -> rechazado", () => {
    expect(transicionValidaPedido("generado", "rechazado")).toBe(true);
  });

  it("rechaza confirmado -> generado", () => {
    expect(transicionValidaPedido("confirmado", "generado")).toBe(false);
  });

  it("rechaza rechazado -> confirmado", () => {
    expect(transicionValidaPedido("rechazado", "confirmado")).toBe(false);
  });

  it("rechaza cualquier transicion de un estado a si mismo", () => {
    expect(transicionValidaPedido("generado", "generado")).toBe(false);
    expect(transicionValidaPedido("confirmado", "confirmado")).toBe(false);
    expect(transicionValidaPedido("rechazado", "rechazado")).toBe(false);
    expect(transicionValidaPedido("cancelado", "cancelado")).toBe(false);
  });

  it("rechaza cualquier transicion hacia o desde cancelado", () => {
    expect(transicionValidaPedido("generado", "cancelado")).toBe(false);
    expect(transicionValidaPedido("confirmado", "cancelado")).toBe(false);
    expect(transicionValidaPedido("cancelado", "confirmado")).toBe(false);
  });
});
