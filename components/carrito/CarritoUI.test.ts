import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PublicDishCard from "@/components/storefront/PublicDishCard";
import { CarritoProvider } from "./CarritoProvider";
import { CajonCarritoVista } from "./CajonCarrito";
import ConfirmarPedido from "./ConfirmarPedido";
import RevisarCambios from "./RevisarCambios";
import ControlCantidad from "./ControlCantidad";

const COCINA = "11111111-1111-4111-8111-111111111111";
const PLATO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("UI inicial del carrito", () => {
  it("mantiene legible el plato y ofrece un control Agregar accesible", () => {
    const html = renderToStaticMarkup(
      createElement(CarritoProvider, null,
        createElement(PublicDishCard, {
          vianderaId: COCINA,
          plato: { id: PLATO, nombre: "Tarta de calabaza", descripcion: "Con masa casera", precio: 4200, tipo: "cena", fotoUrl: null, etiquetas: [] },
        }),
      ),
    );

    expect(html).toContain("Tarta de calabaza");
    expect(html).toContain("Con masa casera");
    expect(html).toContain("$4.200");
    expect(html).toContain("Cargando pedido de Tarta de calabaza");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).not.toContain("Agregar Tarta de calabaza al pedido");
    expect(html).toContain("min-h-[44px]");
    expect(html).not.toContain("href=");
  });

  it("deshabilita el incremento al llegar a 50 en el control compartido", () => {
    const html = renderToStaticMarkup(createElement(ControlCantidad, {
      nombre: "Tarta",
      cantidad: 50,
      onIncrementar: () => undefined,
      onDecrementar: () => undefined,
    }));
    expect(html).toMatch(/aria-label="Agregar una Tarta \(máximo alcanzado\)"[^>]*disabled/);
    expect(html).toContain("disabled:opacity-50");
  });

  it("presenta una libreta con conteo, edición, subtotal actual y continuidad", () => {
    const html = renderToStaticMarkup(createElement(CajonCarritoVista, {
      nombreViandera: "Cocina Ana",
      carrito: { vianderaId: COCINA, items: [{ platoId: PLATO, cantidad: 2 }] },
      platos: [{ id: PLATO, nombre: "Tarta", precio: 4200 }],
      abierto: false,
      onAbrir: () => undefined,
      onCerrar: () => undefined,
      onIncrementar: () => undefined,
      onDecrementar: () => undefined,
      onVaciar: () => undefined,
    }));

    expect(html).toContain("Tu pedido");
    expect(html).toContain("2 platos");
    expect(html).toContain("Ver pedido");
    expect(html).toContain("Tu pedido en Cocina Ana");
    expect(html).toContain("Subtotal actual estimado");
    expect(html).toContain("$8.400");
    expect(html).toContain("Continuar");
    expect(html).toContain("Quitar una Tarta");
    expect(html).toContain("Agregar una Tarta");
  });

  it("no presenta un precio nulo como gratuito", () => {
    const html = renderToStaticMarkup(createElement(CajonCarritoVista, {
      nombreViandera: "Cocina Ana",
      carrito: { vianderaId: COCINA, items: [{ platoId: PLATO, cantidad: 1 }] },
      platos: [{ id: PLATO, nombre: "Tarta", precio: null }],
      abierto: false,
      onAbrir: () => undefined,
      onCerrar: () => undefined,
      onIncrementar: () => undefined,
      onDecrementar: () => undefined,
      onVaciar: () => undefined,
    }));
    expect(html).toContain("Precio a revisar");
    expect(html).not.toContain("Subtotal actual estimado: $0");
  });
});

describe("confirmación del pedido", () => {
  const props = {
    viandera: { id: COCINA, nombre: "Cocina Ana", slug: "cocina-ana" },
    items: [{ platoId: PLATO, vianderaId: COCINA, nombre: "Tarta", precio: 4200, cantidad: 2 }],
    modalidades: [
      { id: "retiro" as const, etiqueta: "Retiro", costo: 0 },
      { id: "envio_propio" as const, etiqueta: "Envío de la cocina", costo: 900 },
    ],
  };

  it("renderiza campos requeridos, modalidades del servidor y total estimado", () => {
    const html = renderToStaticMarkup(createElement(ConfirmarPedido, props));

    expect(html).toContain("Confirmá tu pedido");
    expect(html).toMatch(/<input[^>]*id="nombre"[^>]*required/);
    expect(html).toMatch(/<input[^>]*id="telefono"[^>]*required/);
    expect(html).toContain("Retiro");
    expect(html).toContain("Envío de la cocina");
    expect(html).toContain("Total estimado");
    expect(html).toContain("$8.400");
    expect(html).toContain("Continuar por WhatsApp");
    expect(html).toContain("name=" + '"aceptaMarketing"');
    expect(html).not.toMatch(/name="aceptaMarketing"[^>]*checked/);
  });

  it("explica cambios concretos y conserva una salida a la cocina", () => {
    const html = renderToStaticMarkup(createElement(RevisarCambios, {
      slug: "cocina-ana",
      cambios: [
        { tipo: "plato_no_disponible", vianda_id: PLATO },
        { tipo: "precio_cambio", vianda_id: PLATO, precio_esperado: 4200, precio_actual: 4500 },
        { tipo: "costo_envio_cambio", modalidad: "envio_propio", costo_esperado: 900, costo_actual: 1000 },
      ],
      nombresPorId: { [PLATO]: "Tarta" },
    }));
    expect(html).toContain("Tarta ya no está disponible");
    expect(html).toContain("ahora cuesta $4.500");
    expect(html).toContain("envío ahora cuesta $1.000");
    expect(html).toContain("Volver a la cocina");
    expect(html).toContain('href="/cocina-ana"');
  });
});
