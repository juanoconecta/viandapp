import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearClienteIntegracion } from "@/lib/testing/clienteIntegracion";

// Cubre el Paso 3 del plan de CRM (Task 3) contra viandapp-staging, ya
// migrado con supabase/migrations/202609050001_crm_integrado.sql.
//
// Todos los pedidos de este archivo se insertan directamente con el
// cliente service_role (como haría crear_pedido_atomico en producción,
// cuya única concesión de EXECUTE es a service_role) para disparar el
// trigger crm_vincular_pedido_consentido tal como ocurriría en un pedido
// real. No hay acciones "retirar consentimiento" / "anonimizar" en la
// migración (son operaciones de admin todavía sin UI): se modelan acá como
// updates directos a crm_contactos, respetando exactamente las mismas
// restricciones (crm_contactos_anonimizacion_consistente) que tendría que
// respetar cualquier futura acción de admin.
//
// Todas las filas creadas llevan el sufijo SUFIJO en algún campo de texto
// libre y se borran en afterAll filtrando exclusivamente por esos ids/tag.

const SUFIJO = crypto.randomUUID();
const admin = crearClienteIntegracion();

// Un número de teléfono argentino sintético de 10 dígitos, determinístico
// por (SUFIJO, sal) -- distinto por caso de test dentro de esta corrida, y
// distinto entre corridas porque SUFIJO es un UUID nuevo cada vez. No hace
// falta que el número en sí contenga el SUFIJO como substring: la limpieza
// se apoya en nombre_libre (que sí lo lleva en todo contacto creado acá) y
// en los ids trackeados explícitamente en idsACrear.
function numeroUnico(sal: string): string {
  // Números regulares alcanzan de sobra: hash siempre queda < 10_000_000_000
  // por el módulo en cada paso, así que hash*131 nunca se acerca a
  // Number.MAX_SAFE_INTEGER. No hace falta BigInt para este propósito.
  const texto = `${SUFIJO}:${sal}`;
  let hash = 0;
  for (const ch of texto) {
    hash = (hash * 131 + ch.charCodeAt(0)) % 10000000000;
  }
  return hash.toString().padStart(10, "3");
}

const idsACrear = {
  vianderas: [] as string[],
  pedidos: [] as string[],
  crmContactos: [] as string[],
};

let vianderaId: string;

async function crearPedidoConsentido(opts: {
  telefono: string;
  nombre?: string;
  aceptaMarketing: boolean;
}) {
  const { data: pedido, error } = await admin
    .from("pedidos")
    .insert({
      idempotency_key: crypto.randomUUID(),
      request_hash: `hash-${SUFIJO}-${crypto.randomUUID()}`,
      vianderas_id: vianderaId,
      modalidad: "retiro",
      total: 1500,
      nombre_comprador: opts.nombre ?? `Consumidor test ${SUFIJO}`,
      telefono_comprador: opts.telefono,
      acepta_marketing: opts.aceptaMarketing,
      consentimiento_marketing_en: opts.aceptaMarketing ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error || !pedido) throw new Error(`no se pudo crear pedido de prueba: ${error?.message}`);
  idsACrear.pedidos.push(pedido.id);
  return pedido;
}

async function limpiarTodo() {
  // Mismo orden que en sincronizacion.integration.test.ts: crm_contactos
  // (ON DELETE RESTRICT hacia vianderas) y pedidos (también RESTRICT hacia
  // vianderas) tienen que borrarse antes que sus padres.
  if (idsACrear.vianderas.length > 0) {
    await admin.from("crm_contactos").delete().in("viandera_id", idsACrear.vianderas);
  }
  if (idsACrear.crmContactos.length > 0) {
    await admin.from("crm_contactos").delete().in("id", idsACrear.crmContactos);
  }
  await admin.from("crm_contactos").delete().like("nombre_libre", `%${SUFIJO}%`);

  if (idsACrear.pedidos.length > 0) {
    await admin.from("pedido_items").delete().in("pedido_id", idsACrear.pedidos);
    await admin.from("pedidos").delete().in("id", idsACrear.pedidos);
  }
  if (idsACrear.vianderas.length > 0) {
    await admin.from("vianderas").delete().in("id", idsACrear.vianderas);
  }
}

beforeAll(async () => {
  const { data: viandera, error } = await admin
    .from("vianderas")
    .insert({
      nombre: `Viandera consentimiento test ${SUFIJO}`,
      bio: null,
      lat: null,
      lng: null,
      telefono: null,
      activo: true,
      user_id: null,
      slug: null,
    })
    .select()
    .single();
  if (error || !viandera) throw new Error(`no se pudo crear viandera de prueba: ${error?.message}`);
  vianderaId = viandera.id;
  idsACrear.vianderas.push(vianderaId);
});

afterAll(async () => {
  await limpiarTodo();
});

describe("consentimiento: alta básica", () => {
  it("un pedido con acepta_marketing=true crea un contacto consumidor y su puente", async () => {
    const telefono = numeroUnico("alta");
    const pedido = await crearPedidoConsentido({ telefono, aceptaMarketing: true });

    const { data: contacto, error } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("contacto_normalizado", telefono)
      .eq("tipo", "consumidor")
      .single();

    expect(error).toBeNull();
    expect(contacto).not.toBeNull();
    expect(contacto!.tipo).toBe("consumidor");
    expect(contacto!.fuente).toBe("pedido");
    expect(contacto!.contacto_libre).toBe(telefono);
    expect(contacto!.viandera_id).toBeNull();
    expect(contacto!.interesado_id).toBeNull();
    idsACrear.crmContactos.push(contacto!.id);

    const { data: puente, error: errorPuente } = await admin
      .from("crm_contacto_pedidos")
      .select("*")
      .eq("contacto_id", contacto!.id)
      .eq("pedido_id", pedido.id)
      .maybeSingle();
    expect(errorPuente).toBeNull();
    expect(puente).not.toBeNull();
  });

  it("un pedido con acepta_marketing=false no crea contacto ni puente", async () => {
    const telefono = numeroUnico("sinconsentir");
    const pedido = await crearPedidoConsentido({ telefono, aceptaMarketing: false });

    const { data: contacto } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("contacto_normalizado", telefono)
      .maybeSingle();
    expect(contacto).toBeNull();

    const { data: puentes } = await admin
      .from("crm_contacto_pedidos")
      .select("*")
      .eq("pedido_id", pedido.id);
    expect(puentes).toEqual([]);
  });
});

describe("consentimiento: normalización de teléfono", () => {
  it("3548 635151, +54 3548 635151 y +54 9 3548-635151 producen un solo contacto y tres puentes", async () => {
    const base = numeroUnico("variantes"); // 10 dígitos, ej. "3548635151"-like
    const cuatro = base.slice(0, 4);
    const resto = base.slice(4);

    const variantes = [
      `${cuatro} ${resto}`, // sin código de país
      `+54 ${cuatro} ${resto}`, // con código de país, sin el 9 móvil
      `+54 9 ${cuatro}-${resto}`, // con código de país y 9 móvil
    ];

    const pedidos = [];
    for (const telefono of variantes) {
      pedidos.push(await crearPedidoConsentido({ telefono, aceptaMarketing: true }));
    }

    const { data: contactos, error } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("contacto_normalizado", base)
      .eq("tipo", "consumidor");

    expect(error).toBeNull();
    expect(contactos).toHaveLength(1);
    idsACrear.crmContactos.push(contactos![0].id);

    const { data: puentes, error: errorPuentes } = await admin
      .from("crm_contacto_pedidos")
      .select("pedido_id")
      .eq("contacto_id", contactos![0].id);

    expect(errorPuentes).toBeNull();
    expect(puentes).toHaveLength(3);
    const idsPuenteados = new Set(puentes!.map((p) => p.pedido_id));
    for (const pedido of pedidos) {
      expect(idsPuenteados.has(pedido.id)).toBe(true);
    }
  });
});

describe("consentimiento: retiro y reactivación", () => {
  const telefono = numeroUnico("retiro");
  let contactoId: string;
  let primerPedidoId: string;

  beforeAll(async () => {
    const pedido = await crearPedidoConsentido({ telefono, aceptaMarketing: true });
    primerPedidoId = pedido.id;
    const { data: contacto } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("contacto_normalizado", telefono)
      .single();
    contactoId = contacto!.id;
    idsACrear.crmContactos.push(contactoId);
  });

  it("retirar consentimiento conserva contacto y puentes, y marca el timestamp", async () => {
    const ahora = new Date().toISOString();
    const { error: errorUpdate } = await admin
      .from("crm_contactos")
      .update({ consentimiento_retirado_en: ahora })
      .eq("id", contactoId);
    expect(errorUpdate).toBeNull();

    const { data: contacto, error } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("id", contactoId)
      .single();

    expect(error).toBeNull();
    expect(contacto!.consentimiento_retirado_en).not.toBeNull();
    expect(contacto!.nombre_libre).not.toBeNull();
    expect(contacto!.contacto_libre).toBe(telefono);
    expect(contacto!.pii_eliminada).toBe(false);

    const { data: puentes } = await admin
      .from("crm_contacto_pedidos")
      .select("pedido_id")
      .eq("contacto_id", contactoId);
    expect(puentes).toHaveLength(1);
    expect(puentes![0].pedido_id).toBe(primerPedidoId);
  });

  it("un pedido consentido posterior reactiva la fila (no anonimizada) y agrega otro puente", async () => {
    const segundoPedido = await crearPedidoConsentido({ telefono, aceptaMarketing: true });

    const { data: contacto, error } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("id", contactoId)
      .single();

    expect(error).toBeNull();
    // Sigue siendo la MISMA fila (mismo id), reactivada in place.
    expect(contacto!.id).toBe(contactoId);
    expect(contacto!.consentimiento_retirado_en).toBeNull();
    expect(contacto!.pii_eliminada).toBe(false);

    const { data: puentes } = await admin
      .from("crm_contacto_pedidos")
      .select("pedido_id")
      .eq("contacto_id", contactoId);
    expect(puentes).toHaveLength(2);
    const idsPuenteados = new Set(puentes!.map((p) => p.pedido_id));
    expect(idsPuenteados.has(primerPedidoId)).toBe(true);
    expect(idsPuenteados.has(segundoPedido.id)).toBe(true);
  });
});

describe("consentimiento: anonimización", () => {
  const telefono = numeroUnico("anonimizar");
  let contactoId: string;
  let pedidoId: string;

  beforeAll(async () => {
    const pedido = await crearPedidoConsentido({ telefono, aceptaMarketing: true });
    pedidoId = pedido.id;
    const { data: contacto } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("contacto_normalizado", telefono)
      .single();
    contactoId = contacto!.id;
    idsACrear.crmContactos.push(contactoId);
  });

  it("anonimizar nullea PII, conserva puentes, y la vista devuelve nombre/contacto null aunque el pedido retenga PII", async () => {
    const { error: errorAnonimizar } = await admin
      .from("crm_contactos")
      .update({
        nombre_libre: null,
        contacto_libre: null,
        pii_eliminada: true,
        consentimiento_retirado_en: new Date().toISOString(),
      })
      .eq("id", contactoId);
    expect(errorAnonimizar).toBeNull();

    const { data: contacto } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("id", contactoId)
      .single();
    expect(contacto!.pii_eliminada).toBe(true);
    expect(contacto!.nombre_libre).toBeNull();
    expect(contacto!.contacto_libre).toBeNull();
    // contacto_normalizado es una columna generada a partir de
    // contacto_libre: al nulear contacto_libre, se nulea también.
    expect(contacto!.contacto_normalizado).toBeNull();

    const { data: puentes } = await admin
      .from("crm_contacto_pedidos")
      .select("pedido_id")
      .eq("contacto_id", contactoId);
    expect(puentes).toHaveLength(1);
    expect(puentes![0].pedido_id).toBe(pedidoId);

    const { data: resumen, error: errorResumen } = await admin
      .from("crm_contactos_resumen")
      .select("*")
      .eq("id", contactoId)
      .single();
    expect(errorResumen).toBeNull();
    expect(resumen!.nombre).toBeNull();
    expect(resumen!.contacto).toBeNull();
    expect(resumen!.pii_eliminada).toBe(true);

    // El pedido en sí (fuera del CRM) todavía conserva su PII -- la
    // anonimización del CRM no toca la tabla pedidos, y la vista nunca la
    // une, así que ese PII retenido no puede filtrarse por acá.
    const { data: pedidoOriginal } = await admin
      .from("pedidos")
      .select("nombre_comprador, telefono_comprador")
      .eq("id", pedidoId)
      .single();
    expect(pedidoOriginal!.nombre_comprador).not.toBeNull();
    expect(pedidoOriginal!.telefono_comprador).toBe(telefono);
  });

  it("un consentimiento nuevo después de anonimizar crea otro contacto y deja intacta la fila anónima anterior", async () => {
    const nuevoPedido = await crearPedidoConsentido({ telefono, aceptaMarketing: true });

    const { data: nuevoContacto, error } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("contacto_normalizado", telefono)
      .eq("tipo", "consumidor")
      .single();

    expect(error).toBeNull();
    expect(nuevoContacto).not.toBeNull();
    expect(nuevoContacto!.id).not.toBe(contactoId);
    expect(nuevoContacto!.pii_eliminada).toBe(false);
    expect(nuevoContacto!.nombre_libre).not.toBeNull();
    expect(nuevoContacto!.contacto_libre).toBe(telefono);
    idsACrear.crmContactos.push(nuevoContacto!.id);

    const { data: puenteNuevo } = await admin
      .from("crm_contacto_pedidos")
      .select("*")
      .eq("contacto_id", nuevoContacto!.id)
      .eq("pedido_id", nuevoPedido.id)
      .maybeSingle();
    expect(puenteNuevo).not.toBeNull();

    // La fila anónima anterior no fue tocada ni fusionada.
    const { data: anonimoIntacto } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("id", contactoId)
      .single();
    expect(anonimoIntacto!.pii_eliminada).toBe(true);
    expect(anonimoIntacto!.nombre_libre).toBeNull();
    expect(anonimoIntacto!.contacto_libre).toBeNull();
    expect(anonimoIntacto!.contacto_normalizado).toBeNull();
  });
});
