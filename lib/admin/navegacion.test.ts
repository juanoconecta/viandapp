import { describe, expect, it } from "vitest";
import { itemsAdmin } from "./navegacion";

describe("itemsAdmin", () => {
  it("mantiene el orden exacto: Inicio, CRM, Pedidos, Puni", () => {
    expect(itemsAdmin.map((item) => item.label)).toEqual([
      "Inicio",
      "CRM",
      "Pedidos",
      "Puni",
    ]);
  });

  it("cada href es único", () => {
    const hrefs = itemsAdmin.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("cada href empieza con /admin", () => {
    for (const item of itemsAdmin) {
      expect(item.href.startsWith("/admin")).toBe(true);
    }
  });

  it("apunta a las rutas exactas esperadas", () => {
    expect(itemsAdmin).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "CRM", href: "/admin/crm" },
      { label: "Pedidos", href: "/admin/pedidos" },
      { label: "Puni", href: "/admin/puni" },
    ]);
  });
});
