import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { obtenerDetalleContacto, listarContactos, obtenerResumenAdmin } from "./consultas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function crearConsultaFalsa(resultado: any) {
  const llamadas: Record<string, unknown[][]> = {};
  const registrar = (metodo: string, args: unknown[]) => {
    (llamadas[metodo] ??= []).push(args);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = { llamadas };
  for (const metodo of ["select", "eq", "lt", "not", "is", "or", "in", "order"]) {
    query[metodo] = vi.fn((...args: unknown[]) => {
      registrar(metodo, args);
      return query;
    });
  }
  query.maybeSingle = vi.fn(() => Promise.resolve(resultado));
  query.single = vi.fn(() => Promise.resolve(resultado));
  query.then = (
    resolve: (value: typeof resultado) => void,
    reject?: (reason: unknown) => void,
  ) => Promise.resolve(resultado).then(resolve, reject);

  return query;
}

function mockearFrom(porTabla: Record<string, ReturnType<typeof crearConsultaFalsa>>) {
  const from = vi.fn((tabla: string) => {
    const query = porTabla[tabla];
    if (!query) throw new Error(`tabla inesperada en el mock: ${tabla}`);
    return query;
  });
  createAdminClient.mockReturnValue({ from });
  return from;
}

beforeEach(() => {
  createAdminClient.mockReset();
});

describe("obtenerResumenAdmin", () => {
  it("cuenta contactos nuevos y tareas vencidas por separado", async () => {
    const queryContactos = crearConsultaFalsa({ count: 3, error: null });
    const queryTareas = crearConsultaFalsa({ count: 5, error: null });
    mockearFrom({ crm_contactos: queryContactos, crm_tareas: queryTareas });

    const resultado = await obtenerResumenAdmin();

    expect(resultado).toEqual({ contactosNuevos: 3, tareasVencidas: 5 });
    expect(queryContactos.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(queryContactos.eq).toHaveBeenCalledWith("estado", "nuevo");
  });

  it("nunca cuenta como vencida una tarea sin fecha de vencimiento (vence_en null)", async () => {
    const queryContactos = crearConsultaFalsa({ count: 0, error: null });
    const queryTareas = crearConsultaFalsa({ count: 0, error: null });
    mockearFrom({ crm_contactos: queryContactos, crm_tareas: queryTareas });

    await obtenerResumenAdmin();

    expect(queryTareas.eq).toHaveBeenCalledWith("completada", false);
    expect(queryTareas.lt).toHaveBeenCalledWith("vence_en", expect.any(String));
    expect(queryTareas.not).toHaveBeenCalledWith("vence_en", "is", null);
  });

  it("devuelve 0 cuando count viene null", async () => {
    const queryContactos = crearConsultaFalsa({ count: null, error: null });
    const queryTareas = crearConsultaFalsa({ count: null, error: null });
    mockearFrom({ crm_contactos: queryContactos, crm_tareas: queryTareas });

    await expect(obtenerResumenAdmin()).resolves.toEqual({
      contactosNuevos: 0,
      tareasVencidas: 0,
    });
  });
});

describe("listarContactos", () => {
  it("consulta la vista crm_contactos_resumen, no la tabla cruda", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    const from = mockearFrom({ crm_contactos_resumen: query });

    await listarContactos();

    expect(from).toHaveBeenCalledWith("crm_contactos_resumen");
  });

  it("ordena por updated_at descendente siempre", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos();

    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("filtra por tipo exacto cuando se pasa", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ tipo: "cocina_activa" });

    expect(query.llamadas.eq).toContainEqual(["tipo", "cocina_activa"]);
  });

  it("filtra por estado exacto cuando se pasa", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ estado: "calificado" });

    expect(query.llamadas.eq).toContainEqual(["estado", "calificado"]);
  });

  it("no aplica ningún filtro de tipo/estado cuando no se pasan", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos();

    expect(query.llamadas.eq ?? []).toHaveLength(0);
  });

  it("busqueda arma un OR ilike contra nombre y contacto", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ busqueda: "Rosa" });

    expect(query.or).toHaveBeenCalledWith("nombre.ilike.%Rosa%,contacto.ilike.%Rosa%");
  });

  it("consentimiento 'vigente' filtra pii_eliminada=false y consentimiento_retirado_en null", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ consentimiento: "vigente" });

    expect(query.llamadas.eq).toContainEqual(["pii_eliminada", false]);
    expect(query.is).toHaveBeenCalledWith("consentimiento_retirado_en", null);
  });

  it("consentimiento 'retirado' filtra pii_eliminada=false y consentimiento_retirado_en not null", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ consentimiento: "retirado" });

    expect(query.llamadas.eq).toContainEqual(["pii_eliminada", false]);
    expect(query.not).toHaveBeenCalledWith("consentimiento_retirado_en", "is", null);
  });

  it("consentimiento 'anonimizado' filtra pii_eliminada=true", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ consentimiento: "anonimizado" });

    expect(query.llamadas.eq).toContainEqual(["pii_eliminada", true]);
  });

  it("no agrega un filtro implícito de tipo=consumidor cuando solo se pasa consentimiento", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ consentimiento: "vigente" });

    const llamadasTipo = (query.llamadas.eq ?? []).filter(
      ([columna]: unknown[]) => columna === "tipo",
    );
    expect(llamadasTipo).toHaveLength(0);
  });

  it("combina tipo y consentimiento cuando ambos se pasan explícitamente", async () => {
    const query = crearConsultaFalsa({ data: [], error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await listarContactos({ tipo: "consumidor", consentimiento: "retirado" });

    expect(query.llamadas.eq).toContainEqual(["tipo", "consumidor"]);
    expect(query.llamadas.eq).toContainEqual(["pii_eliminada", false]);
  });

  it("lanza un mensaje de dominio (no el error crudo) cuando la consulta falla", async () => {
    const query = crearConsultaFalsa({ data: null, error: { message: "relation does not exist" } });
    mockearFrom({ crm_contactos_resumen: query });

    await expect(listarContactos()).rejects.toThrow("No pudimos obtener los contactos.");
  });

  it("devuelve [] cuando data es null pero no hubo error", async () => {
    const query = crearConsultaFalsa({ data: null, error: null });
    mockearFrom({ crm_contactos_resumen: query });

    await expect(listarContactos()).resolves.toEqual([]);
  });
});

describe("obtenerDetalleContacto", () => {
  const CONTACTO = {
    id: "c1",
    tipo: "consumidor",
    fuente: "pedido",
    estado: "nuevo",
    etiquetas: [],
    consentimiento_retirado_en: null,
    pii_eliminada: false,
    nombre: "Ana",
    contacto: "3491234567",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  it("devuelve null cuando el contacto no existe", async () => {
    const queryContacto = crearConsultaFalsa({ data: null, error: null });
    mockearFrom({ crm_contactos_resumen: queryContacto });

    await expect(obtenerDetalleContacto("no-existe")).resolves.toBeNull();
  });

  it("nunca selecciona columnas de PII del comprador en la consulta de pedidos puente", async () => {
    const queryContacto = crearConsultaFalsa({ data: CONTACTO, error: null });
    const queryNotas = crearConsultaFalsa({ data: [], error: null });
    const queryTareas = crearConsultaFalsa({ data: [], error: null });
    const queryInteracciones = crearConsultaFalsa({ data: [], error: null });
    const queryPuentes = crearConsultaFalsa({ data: [{ pedido_id: "p1" }], error: null });
    const queryPedidos = crearConsultaFalsa({
      data: [
        {
          id: "p1",
          total: 1500,
          modalidad: "retiro",
          estado: "confirmado",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      error: null,
    });

    mockearFrom({
      crm_contactos_resumen: queryContacto,
      crm_notas: queryNotas,
      crm_tareas: queryTareas,
      crm_interacciones: queryInteracciones,
      crm_contacto_pedidos: queryPuentes,
      pedidos: queryPedidos,
    });

    const detalle = await obtenerDetalleContacto("c1");

    expect(queryPedidos.select).toHaveBeenCalledWith(
      "id, total, modalidad, estado, created_at",
    );
    const columnasSeleccionadas = String(queryPedidos.select.mock.calls[0][0]);
    expect(columnasSeleccionadas).not.toContain("nombre_comprador");
    expect(columnasSeleccionadas).not.toContain("telefono_comprador");
    expect(columnasSeleccionadas).not.toContain("direccion_envio");

    expect(detalle?.pedidos).toEqual([
      {
        id: "p1",
        total: 1500,
        modalidad: "retiro",
        estado: "confirmado",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("no consulta la tabla pedidos cuando no hay puentes", async () => {
    const queryContacto = crearConsultaFalsa({ data: CONTACTO, error: null });
    const queryNotas = crearConsultaFalsa({ data: [], error: null });
    const queryTareas = crearConsultaFalsa({ data: [], error: null });
    const queryInteracciones = crearConsultaFalsa({ data: [], error: null });
    const queryPuentes = crearConsultaFalsa({ data: [], error: null });

    const from = mockearFrom({
      crm_contactos_resumen: queryContacto,
      crm_notas: queryNotas,
      crm_tareas: queryTareas,
      crm_interacciones: queryInteracciones,
      crm_contacto_pedidos: queryPuentes,
    });

    const detalle = await obtenerDetalleContacto("c1");

    expect(from).not.toHaveBeenCalledWith("pedidos");
    expect(detalle?.pedidos).toEqual([]);
  });

  it("arma el detalle completo con contacto, notas, tareas e interacciones", async () => {
    const NOTA = { id: "n1", contacto_id: "c1", texto: "Llamar de nuevo", created_at: "2026-01-01T00:00:00.000Z" };
    const TAREA = {
      id: "t1",
      contacto_id: "c1",
      titulo: "Seguimiento",
      vence_en: null,
      completada: false,
      completada_en: null,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const INTERACCION = {
      id: "i1",
      contacto_id: "c1",
      tipo: "whatsapp",
      resumen: "Confirmó pedido",
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    };

    const queryContacto = crearConsultaFalsa({ data: CONTACTO, error: null });
    const queryNotas = crearConsultaFalsa({ data: [NOTA], error: null });
    const queryTareas = crearConsultaFalsa({ data: [TAREA], error: null });
    const queryInteracciones = crearConsultaFalsa({ data: [INTERACCION], error: null });
    const queryPuentes = crearConsultaFalsa({ data: [], error: null });

    mockearFrom({
      crm_contactos_resumen: queryContacto,
      crm_notas: queryNotas,
      crm_tareas: queryTareas,
      crm_interacciones: queryInteracciones,
      crm_contacto_pedidos: queryPuentes,
    });

    const detalle = await obtenerDetalleContacto("c1");

    expect(detalle).toEqual({
      contacto: CONTACTO,
      notas: [NOTA],
      tareas: [TAREA],
      interacciones: [INTERACCION],
      pedidos: [],
    });
    expect(queryNotas.eq).toHaveBeenCalledWith("contacto_id", "c1");
    expect(queryNotas.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});
