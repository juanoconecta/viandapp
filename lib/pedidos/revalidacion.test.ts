import { describe, expect, it } from "vitest";
import { detectarCambios } from "./revalidacion";

describe("detectarCambios", () => {
  it("no informa cambios cuando cada plato solicitado sigue disponible con su precio", () => {
    expect(
      detectarCambios(
        [{ viandaId: "milanesa", nombreVisto: "Milanesa", precioVisto: 4200 }],
        [{ id: "milanesa", nombre: "Milanesa actual", precio: 4200, disponible: true }],
      ),
    ).toEqual([]);
  });

  it.each([
    ["no figura en el catalogo", []],
    ["ya no esta disponible", [{ id: "milanesa", nombre: "Milanesa", precio: 4200, disponible: false }]],
    ["no tiene precio vigente", [{ id: "milanesa", nombre: "Milanesa", precio: null, disponible: true }]],
  ])("informa plato no disponible si %s", (_caso, actuales) => {
    expect(
      detectarCambios(
        [{ viandaId: "milanesa", nombreVisto: "Milanesa", precioVisto: 4200 }],
        actuales,
      ),
    ).toEqual([{ tipo: "plato_no_disponible", vianda_id: "milanesa" }]);
  });

  it("informa el precio anterior y vigente cuando cambia", () => {
    expect(
      detectarCambios(
        [{ viandaId: "empanada", nombreVisto: "Empanada", precioVisto: 1800 }],
        [{ id: "empanada", nombre: "Empanada", precio: 2000, disponible: true }],
      ),
    ).toEqual([
      {
        tipo: "precio_cambio",
        vianda_id: "empanada",
        precio_esperado: 1800,
        precio_actual: 2000,
      },
    ]);
  });

  it("conserva el orden del carrito e ignora platos ajenos", () => {
    expect(
      detectarCambios(
        [
          { viandaId: "primera", nombreVisto: "Primera", precioVisto: 1000 },
          { viandaId: "segunda", nombreVisto: "Segunda", precioVisto: 2000 },
          { viandaId: "tercera", nombreVisto: "Tercera", precioVisto: 3000 },
        ],
        [
          { id: "ajena", nombre: "Ajena", precio: null, disponible: false },
          { id: "tercera", nombre: "Tercera", precio: 3000, disponible: false },
          { id: "segunda", nombre: "Segunda", precio: 2500, disponible: true },
          { id: "primera", nombre: "Primera", precio: 1000, disponible: true },
        ],
      ),
    ).toEqual([
      {
        tipo: "precio_cambio",
        vianda_id: "segunda",
        precio_esperado: 2000,
        precio_actual: 2500,
      },
      { tipo: "plato_no_disponible", vianda_id: "tercera" },
    ]);
  });

  it("no modifica los datos del carrito ni del catalogo", () => {
    const items = [{ viandaId: "milanesa", nombreVisto: "Milanesa", precioVisto: 4200 }];
    const actuales = [{ id: "milanesa", nombre: "Milanesa", precio: 4500, disponible: true }];
    const itemsAntes = structuredClone(items);
    const actualesAntes = structuredClone(actuales);

    detectarCambios(items, actuales);

    expect(items).toEqual(itemsAntes);
    expect(actuales).toEqual(actualesAntes);
  });
});
