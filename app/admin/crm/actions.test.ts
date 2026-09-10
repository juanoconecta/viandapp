import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, createAdminClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/auth/admin", () => ({
  esAdmin: (email?: string | null) => email === "admin@viandapp.test",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import {
  actualizarEstadoContacto,
  agregarNota,
  anonimizarContacto,
  completarTarea,
  crearContactoLibre,
  crearTarea,
  registrarInteraccion,
  retirarConsentimiento,
  vincularPedidoManualmente,
} from "./actions";

const ADMIN = { email: "admin@viandapp.test" };
const NO_ADMIN = { email: "otra@persona.test" };

function comoAdmin() {
  getUser.mockResolvedValue({ data: { user: ADMIN } });
}
function comoNoAdmin() {
  getUser.mockResolvedValue({ data: { user: NO_ADMIN } });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function crearQueryFalsa(resultado: any) {
  const llamadas: Record<string, unknown[][]> = {};
  const registrar = (metodo: string, args: unknown[]) => {
    (llamadas[metodo] ??= []).push(args);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = { llamadas };
  for (const metodo of ["select", "eq", "insert", "update"]) {
    query[metodo] = vi.fn((...args: unknown[]) => {
      registrar(metodo, args);
      return query;
    });
  }
  query.then = (
    resolve: (value: typeof resultado) => void,
    reject?: (reason: unknown) => void,
  ) => Promise.resolve(resultado).then(resolve, reject);

  return query;
}

function mockearAdmin(porTabla: Record<string, ReturnType<typeof crearQueryFalsa>>) {
  const from = vi.fn((tabla: string) => {
    const query = porTabla[tabla];
    if (!query) throw new Error(`tabla inesperada en el mock: ${tabla}`);
    return query;
  });
  createAdminClient.mockReturnValue({ from });
  return from;
}

function formData(valores: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [clave, valor] of Object.entries(valores)) fd.set(clave, valor);
  return fd;
}

beforeEach(() => {
  getUser.mockReset();
  createAdminClient.mockReset();
  vi.mocked(revalidatePath).mockReset();
});

describe("crearContactoLibre", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await crearContactoLibre(
      { status: "idle" },
      formData({ tipo: "otro", nombreLibre: "Panadería del barrio" }),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza tipos distintos de aliado_estrategico/otro antes de tocar la base", async () => {
    comoAdmin();

    const resultado = await crearContactoLibre(
      { status: "idle" },
      formData({ tipo: "cocina_activa", nombreLibre: "Cocina X" }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza nombre_libre vacío tras trim", async () => {
    comoAdmin();

    const resultado = await crearContactoLibre(
      { status: "idle" },
      formData({ tipo: "otro", nombreLibre: "   " }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("recorta nombre_libre a 200 caracteres y crea el contacto autorizado", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_contactos: query });

    const nombreLargo = "A".repeat(250);
    const resultado = await crearContactoLibre(
      { status: "idle" },
      formData({ tipo: "aliado_estrategico", nombreLibre: nombreLargo }),
    );

    expect(resultado).toEqual({ status: "ok" });
    expect(query.insert).toHaveBeenCalledWith({
      tipo: "aliado_estrategico",
      nombre_libre: "A".repeat(200),
      fuente: "contacto_directo",
      estado: "nuevo",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/crm");
  });

  it("no acepta ni usa un pedidoId aunque venga en el formulario", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_contactos: query });

    await crearContactoLibre(
      { status: "idle" },
      formData({ tipo: "otro", nombreLibre: "Contacto libre", pedidoId: "p1" }),
    );

    const payload = query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("pedidoId");
    expect(payload).not.toHaveProperty("pedido_id");
  });
});

describe("actualizarEstadoContacto", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await actualizarEstadoContacto(
      { status: "idle" },
      formData({ contactoId: "c1", estado: "activo" }),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza un estado fuera del enum antes de tocar la base", async () => {
    comoAdmin();

    const resultado = await actualizarEstadoContacto(
      { status: "idle" },
      formData({ contactoId: "c1", estado: "en_pausa_inventado" }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("actualiza el estado y revalida admin, listado y detalle", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_contactos: query });

    const resultado = await actualizarEstadoContacto(
      { status: "idle" },
      formData({ contactoId: "c1", estado: "activo" }),
    );

    expect(resultado).toEqual({ status: "ok" });
    expect(query.update).toHaveBeenCalledWith({ estado: "activo" });
    expect(query.eq).toHaveBeenCalledWith("id", "c1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/crm/c1");
  });
});

describe("vincularPedidoManualmente", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await vincularPedidoManualmente(
      { status: "idle" },
      formData({ contactoId: "c1", pedidoId: "p1" }),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("inserta únicamente contacto_id y pedido_id, sin PII", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_contacto_pedidos: query });

    const resultado = await vincularPedidoManualmente(
      { status: "idle" },
      formData({ contactoId: "c1", pedidoId: "p1" }),
    );

    expect(resultado).toEqual({ status: "ok" });
    expect(query.insert).toHaveBeenCalledWith({ contacto_id: "c1", pedido_id: "p1" });
  });

  it("mapea una violación de FK (23503) a un mensaje de dominio", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: { code: "23503", message: "fk violation detail" } });
    mockearAdmin({ crm_contacto_pedidos: query });

    const resultado = await vincularPedidoManualmente(
      { status: "idle" },
      formData({ contactoId: "no-existe", pedidoId: "no-existe" }),
    );

    expect(resultado).toEqual({
      status: "error",
      mensaje: "No encontramos ese contacto o ese pedido.",
    });
  });
});

describe("retirarConsentimiento", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await retirarConsentimiento({ status: "idle" }, formData({ contactoId: "c1" }));

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("actualiza con .eq('tipo', 'consumidor') además del id", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: [{ id: "c1" }], error: null });
    mockearAdmin({ crm_contactos: query });

    const resultado = await retirarConsentimiento({ status: "idle" }, formData({ contactoId: "c1" }));

    expect(resultado).toEqual({ status: "ok" });
    expect(query.llamadas.eq).toContainEqual(["id", "c1"]);
    expect(query.llamadas.eq).toContainEqual(["tipo", "consumidor"]);
    expect(query.update.mock.calls[0][0]).toHaveProperty("consentimiento_retirado_en");
  });

  it("falla con mensaje de dominio si no se afecta ninguna fila (tipo distinto de consumidor)", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: [], error: null });
    mockearAdmin({ crm_contactos: query });

    const resultado = await retirarConsentimiento({ status: "idle" }, formData({ contactoId: "c-cocina" }));

    expect(resultado).toEqual({
      status: "error",
      mensaje: "No encontramos un contacto consumidor con ese ID.",
    });
  });
});

describe("anonimizarContacto", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await anonimizarContacto({ status: "idle" }, formData({ contactoId: "c1" }));

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("nullea nombre y contacto, marca pii_eliminada y consentimiento retirado, filtrando por tipo consumidor", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: [{ id: "c1" }], error: null });
    mockearAdmin({ crm_contactos: query });

    const resultado = await anonimizarContacto({ status: "idle" }, formData({ contactoId: "c1" }));

    expect(resultado).toEqual({ status: "ok" });
    const payload = query.update.mock.calls[0][0];
    expect(payload.nombre_libre).toBeNull();
    expect(payload.contacto_libre).toBeNull();
    expect(payload.pii_eliminada).toBe(true);
    expect(payload).toHaveProperty("consentimiento_retirado_en");
    expect(query.llamadas.eq).toContainEqual(["id", "c1"]);
    expect(query.llamadas.eq).toContainEqual(["tipo", "consumidor"]);
  });

  it("falla con mensaje de dominio si no se afecta ninguna fila", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: [], error: null });
    mockearAdmin({ crm_contactos: query });

    const resultado = await anonimizarContacto({ status: "idle" }, formData({ contactoId: "c-cocina" }));

    expect(resultado).toEqual({
      status: "error",
      mensaje: "No encontramos un contacto consumidor con ese ID.",
    });
  });
});

describe("agregarNota", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await agregarNota(
      { status: "idle" },
      formData({ contactoId: "c1", texto: "Llamó por WhatsApp" }),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza texto vacío tras trim", async () => {
    comoAdmin();

    const resultado = await agregarNota(
      { status: "idle" },
      formData({ contactoId: "c1", texto: "   " }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("recorta el texto a 2000 caracteres y guarda la nota autorizada", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_notas: query });
    const textoLargo = "x".repeat(2500);

    const resultado = await agregarNota(
      { status: "idle" },
      formData({ contactoId: "c1", texto: textoLargo }),
    );

    expect(resultado).toEqual({ status: "ok" });
    expect(query.insert).toHaveBeenCalledWith({ contacto_id: "c1", texto: "x".repeat(2000) });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/crm/c1");
  });
});

describe("crearTarea", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await crearTarea(
      { status: "idle" },
      formData({ contactoId: "c1", titulo: "Llamar mañana" }),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza título vacío tras trim", async () => {
    comoAdmin();

    const resultado = await crearTarea(
      { status: "idle" },
      formData({ contactoId: "c1", titulo: "   " }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("recorta el título a 200 caracteres y crea la tarea sin fecha cuando venceEn no se pasa", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_tareas: query });
    const tituloLargo = "t".repeat(250);

    const resultado = await crearTarea(
      { status: "idle" },
      formData({ contactoId: "c1", titulo: tituloLargo }),
    );

    expect(resultado).toEqual({ status: "ok" });
    expect(query.insert).toHaveBeenCalledWith({
      contacto_id: "c1",
      titulo: "t".repeat(200),
      vence_en: null,
    });
  });

  it("acepta una fecha ISO opcional y la normaliza", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_tareas: query });

    const resultado = await crearTarea(
      { status: "idle" },
      formData({ contactoId: "c1", titulo: "Seguimiento", venceEn: "2026-12-01T00:00:00.000Z" }),
    );

    expect(resultado).toEqual({ status: "ok" });
    expect(query.insert).toHaveBeenCalledWith({
      contacto_id: "c1",
      titulo: "Seguimiento",
      vence_en: "2026-12-01T00:00:00.000Z",
    });
  });

  it("rechaza una fecha inválida antes de tocar la base", async () => {
    comoAdmin();

    const resultado = await crearTarea(
      { status: "idle" },
      formData({ contactoId: "c1", titulo: "Seguimiento", venceEn: "no-es-una-fecha" }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("completarTarea", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await completarTarea(
      { status: "idle" },
      formData({ tareaId: "t1", contactoId: "c1" }),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("escribe completada=true y un timestamp de completada_en", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_tareas: query });

    const resultado = await completarTarea(
      { status: "idle" },
      formData({ tareaId: "t1", contactoId: "c1" }),
    );

    expect(resultado).toEqual({ status: "ok" });
    const payload = query.update.mock.calls[0][0];
    expect(payload.completada).toBe(true);
    expect(typeof payload.completada_en).toBe("string");
    expect(query.eq).toHaveBeenCalledWith("id", "t1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/crm/c1");
  });
});

describe("registrarInteraccion", () => {
  it("rechaza usuarios no-admin antes de crear un cliente privilegiado", async () => {
    comoNoAdmin();

    const resultado = await registrarInteraccion(
      { status: "idle" },
      formData({ contactoId: "c1", tipo: "whatsapp", resumen: "Confirmó pedido" }),
    );

    expect(resultado).toEqual({ status: "error", mensaje: "No autorizado." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza un tipo fuera del enum antes de tocar la base", async () => {
    comoAdmin();

    const resultado = await registrarInteraccion(
      { status: "idle" },
      formData({ contactoId: "c1", tipo: "carta_documento", resumen: "Algo" }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza resumen vacío tras trim", async () => {
    comoAdmin();

    const resultado = await registrarInteraccion(
      { status: "idle" },
      formData({ contactoId: "c1", tipo: "llamada", resumen: "   " }),
    );

    expect(resultado.status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("recorta el resumen a 1000 caracteres y registra la interacción autorizada", async () => {
    comoAdmin();
    const query = crearQueryFalsa({ data: null, error: null });
    mockearAdmin({ crm_interacciones: query });
    const resumenLargo = "r".repeat(1200);

    const resultado = await registrarInteraccion(
      { status: "idle" },
      formData({ contactoId: "c1", tipo: "whatsapp", resumen: resumenLargo }),
    );

    expect(resultado).toEqual({ status: "ok" });
    expect(query.insert).toHaveBeenCalledWith({
      contacto_id: "c1",
      tipo: "whatsapp",
      resumen: "r".repeat(1000),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/crm/c1");
  });
});
