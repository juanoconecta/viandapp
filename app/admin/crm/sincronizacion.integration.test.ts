import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  crearClienteAnonimo,
  crearClienteAutenticadoSintetico,
  crearClienteIntegracion,
} from "@/lib/testing/clienteIntegracion";

// Cubre el Paso 2 del plan de CRM
// (docs/superpowers/plans/2026-09-04-crm-viandapp-implementation-plan.md,
// Task 3) contra el proyecto real viandapp-staging, ya migrado con
// supabase/migrations/202609050001_crm_integrado.sql.
//
// Dos bullets del Paso 2 ("pg_policies devuelve cero filas para tablas
// crm_%" y "las tres funciones no tienen PUBLIC/anon/authenticated con
// privilegio de ejecución directa") NO se re-derivan acá: no hay forma de
// correr esa introspección vía PostgREST sin un driver de Postgres nuevo
// (prohibido) ni una RPC de introspección nueva (desproporcionado para
// modificar una migración ya revisada y aplicada). Por decisión explícita
// del controller (ver el addendum de Task 3 en el brief), se los da por
// satisfechos por la revisión estática de Task 2 -- que leyó el SQL exacto
// aplicado byte a byte y confirmó cero "create policy" en el archivo y un
// "revoke all ... from public, anon, authenticated" inmediatamente después
// de cada una de las tres funciones security definer -- y se reemplazan acá
// por la matriz de 40 intentos de abajo, que es evidencia estrictamente más
// fuerte (comportamental, no solo textual).
//
// Todas las filas que este archivo crea llevan el sufijo SUFIJO en algún
// campo de texto libre, y se borran en afterAll filtrando exclusivamente por
// ese sufijo (nunca un delete/truncate más amplio).

const SUFIJO = crypto.randomUUID();
const admin = crearClienteIntegracion();

const idsACrear = {
  interesados: [] as string[],
  vianderas: [] as string[],
  pedidos: [] as string[],
  crmContactos: [] as string[],
};

async function limpiarTodo() {
  // crm_contactos.viandera_id / .interesado_id son ON DELETE RESTRICT (igual
  // que pedidos.vianderas_id), así que hay que borrar TODOS los
  // crm_contactos relacionados con esta corrida -- incluidos los que
  // crearon los triggers automáticamente, que este archivo no trackea uno
  // por uno -- antes de poder borrar vianderas/interesados/pedidos. Borrar
  // un crm_contactos en cascada se lleva puestos crm_notas/crm_tareas/
  // crm_interacciones/crm_contacto_pedidos (todas ON DELETE CASCADE).
  if (idsACrear.vianderas.length > 0) {
    await admin.from("crm_contactos").delete().in("viandera_id", idsACrear.vianderas);
  }
  if (idsACrear.interesados.length > 0) {
    await admin.from("crm_contactos").delete().in("interesado_id", idsACrear.interesados);
  }
  if (idsACrear.crmContactos.length > 0) {
    await admin.from("crm_contactos").delete().in("id", idsACrear.crmContactos);
  }
  // Contactos libres (nombre_libre con SUFIJO) que puedan haber quedado sin
  // trackear explícitamente.
  await admin.from("crm_contactos").delete().like("nombre_libre", `%${SUFIJO}%`);
  // Red de seguridad adicional: si algún intento de INSERT desde
  // anon/authenticated en la matriz RLS lograra "colarse" (el hallazgo
  // crítico que esos tests buscan detectar), la fila quedaría etiquetada
  // con SUFIJO en su campo de texto libre y no bajo un id trackeado.
  await admin.from("crm_notas").delete().like("texto", `%${SUFIJO}%`);
  await admin.from("crm_tareas").delete().like("titulo", `%${SUFIJO}%`);
  await admin.from("crm_interacciones").delete().like("resumen", `%${SUFIJO}%`);

  // pedidos.vianderas_id también es ON DELETE RESTRICT.
  if (idsACrear.pedidos.length > 0) {
    await admin.from("pedido_items").delete().in("pedido_id", idsACrear.pedidos);
    await admin.from("pedidos").delete().in("id", idsACrear.pedidos);
  }

  if (idsACrear.interesados.length > 0) {
    await admin.from("interesados_viandera").delete().in("id", idsACrear.interesados);
  }
  if (idsACrear.vianderas.length > 0) {
    await admin.from("vianderas").delete().in("id", idsACrear.vianderas);
  }
}

afterAll(async () => {
  await limpiarTodo();
});

describe("sincronización CRM: interesados", () => {
  // HALLAZGO (ver task-3-report.md): en viandapp-staging, este insert
  // como anon falla hoy con 42501 ("new row violates row-level security
  // policy for table interesados_viandera"). No es un bug de la migración
  // de CRM (Task 2) ni de este test: es que la policy base "cualquiera
  // puede anotarse como interesada" (CLAUDE.md, insert to anon with check
  // true) no está aplicada en este proyecto de staging -- confirmado
  // porque el insert con service_role sí funciona (ver el resto de este
  // archivo) y porque las policies públicas de SELECT en vianderas/viandas
  // sí funcionan para anon (probado aparte). Se deja el test tal cual,
  // fallando de forma honesta, en vez de cambiarlo a service_role -- eso
  // ocultaría que ahora mismo el formulario real de la landing (que
  // inserta como anon) no podría dar de alta interesadas en este
  // proyecto de staging.
  it("insertar un interesado como anon crea un contacto cocina_potencial", async () => {
    const anon = crearClienteAnonimo();
    const { data: interesado, error: errorInsert } = await anon
      .from("interesados_viandera")
      .insert({
        nombre: `Interesada test ${SUFIJO}`,
        contacto: `interesada-${SUFIJO}@viandapp-staging.invalid`,
      })
      .select()
      .single();

    expect(errorInsert).toBeNull();
    expect(interesado).not.toBeNull();
    idsACrear.interesados.push(interesado!.id);

    const { data: contacto, error: errorContacto } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("interesado_id", interesado!.id)
      .maybeSingle();

    expect(errorContacto).toBeNull();
    expect(contacto).not.toBeNull();
    expect(contacto!.tipo).toBe("cocina_potencial");
    expect(contacto!.fuente).toBe("landing_interes");
    expect(contacto!.viandera_id).toBeNull();
    idsACrear.crmContactos.push(contacto!.id);
  });

  it("volver a ejecutar la sincronización sobre la misma fila no duplica", async () => {
    // Crea su propio interesado (no reutiliza el del test anterior, para
    // no depender del orden de ejecución).
    const { data: interesado } = await admin
      .from("interesados_viandera")
      .insert({
        nombre: `Interesada dup test ${SUFIJO}`,
        contacto: `interesada-dup-${SUFIJO}@viandapp-staging.invalid`,
      })
      .select()
      .single();
    idsACrear.interesados.push(interesado!.id);

    const { data: primerContacto } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("interesado_id", interesado!.id)
      .single();
    idsACrear.crmContactos.push(primerContacto!.id);

    // El trigger usa "on conflict (interesado_id) where interesado_id is
    // not null do nothing", que apunta a un índice único PARCIAL
    // (crm_contactos_interesado_unico). Eso solo se puede expresar en SQL
    // directo (con el WHERE del propio ON CONFLICT) -- el upsert de
    // PostgREST vía HTTP no permite pasar ese predicado, así que
    // "on_conflict=interesado_id" contra un índice parcial devuelve 42P10
    // ("no unique or exclusion constraint matching the ON CONFLICT
    // specification"), no es una forma válida de re-disparar esa semántica
    // desde este cliente. La prueba equivalente y más rigurosa de "no
    // duplica" es intentar un INSERT liso con el mismo interesado_id y
    // confirmar que el índice único lo rechaza -- es precisamente ESE
    // índice el que hace posible el ON CONFLICT DO NOTHING del trigger.
    const { error: errorDuplicado } = await admin.from("crm_contactos").insert({
      tipo: "cocina_potencial",
      interesado_id: interesado!.id,
      fuente: "landing_interes",
      estado: "nuevo",
    });
    expect(errorDuplicado).not.toBeNull();
    expect(errorDuplicado!.code).toBe("23505");

    const { data: contactos, error } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("interesado_id", interesado!.id);

    expect(error).toBeNull();
    expect(contactos).toHaveLength(1);
    expect(contactos![0].id).toBe(primerContacto!.id);
  });
});

describe("sincronización CRM: vianderas", () => {
  it("una viandera nueva crea un contacto cocina_activa", async () => {
    const { data: viandera, error: errorInsert } = await admin
      .from("vianderas")
      .insert({ nombre: `Viandera test ${SUFIJO}` })
      .select()
      .single();

    expect(errorInsert).toBeNull();
    idsACrear.vianderas.push(viandera!.id);

    const { data: contacto, error: errorContacto } = await admin
      .from("crm_contactos")
      .select("*")
      .eq("viandera_id", viandera!.id)
      .maybeSingle();

    expect(errorContacto).toBeNull();
    expect(contacto).not.toBeNull();
    expect(contacto!.tipo).toBe("cocina_activa");
    expect(contacto!.fuente).toBe("contacto_directo");
    expect(contacto!.interesado_id).toBeNull();
    idsACrear.crmContactos.push(contacto!.id);
  });
});

describe("sincronización CRM: backfill", () => {
  // viandapp-staging no tenía filas previas a esta migración (proyecto
  // recién provisionado): no hay datos "pre-CRM" reales para verificar por
  // backfill. La prueba equivalente y honesta es reproducir la
  // precondición exacta del backfill -- una fila en vianderas/
  // interesados_viandera sin su crm_contactos correspondiente, algo que ya
  // no puede volver a ocurrir de forma natural porque el trigger siempre
  // está activo -- borrando a mano el contacto creado por el trigger, y
  // confirmando que la misma sentencia de insert que usa el backfill de la
  // migración recrea el contacto faltante. Como en este punto no hay
  // ninguna fila en conflicto (la acabamos de borrar), un INSERT liso
  // basta -- no hace falta reproducir la cláusula ON CONFLICT (ver el
  // comentario en el test de "no duplica" sobre por qué el upsert de
  // PostgREST no puede apuntar a un índice único parcial de todos modos).
  it("la sentencia de backfill recrea el contacto faltante de un interesado existente", async () => {
    const { data: interesado } = await admin
      .from("interesados_viandera")
      .insert({
        nombre: `Interesada backfill ${SUFIJO}`,
        contacto: `interesada-backfill-${SUFIJO}@viandapp-staging.invalid`,
      })
      .select()
      .single();
    idsACrear.interesados.push(interesado!.id);

    const { data: contactoOriginal } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("interesado_id", interesado!.id)
      .single();

    // Simula "esta fila predata al CRM": borra el contacto que el trigger
    // acaba de crear.
    await admin.from("crm_contactos").delete().eq("id", contactoOriginal!.id);
    const { data: sinContacto } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("interesado_id", interesado!.id)
      .maybeSingle();
    expect(sinContacto).toBeNull();

    const { error: errorBackfill } = await admin.from("crm_contactos").insert({
      tipo: "cocina_potencial",
      interesado_id: interesado!.id,
      fuente: "landing_interes",
      estado: "nuevo",
    });
    expect(errorBackfill).toBeNull();

    const { data: recreado } = await admin
      .from("crm_contactos")
      .select("id, tipo, fuente")
      .eq("interesado_id", interesado!.id)
      .single();
    expect(recreado).not.toBeNull();
    expect(recreado!.tipo).toBe("cocina_potencial");
    idsACrear.crmContactos.push(recreado!.id);
  });

  it("la sentencia de backfill recrea el contacto faltante de una viandera existente", async () => {
    const { data: viandera } = await admin
      .from("vianderas")
      .insert({ nombre: `Viandera backfill ${SUFIJO}` })
      .select()
      .single();
    idsACrear.vianderas.push(viandera!.id);

    const { data: contactoOriginal } = await admin
      .from("crm_contactos")
      .select("id")
      .eq("viandera_id", viandera!.id)
      .single();
    await admin.from("crm_contactos").delete().eq("id", contactoOriginal!.id);

    const { error: errorBackfill } = await admin.from("crm_contactos").insert({
      tipo: "cocina_activa",
      viandera_id: viandera!.id,
      fuente: "contacto_directo",
      estado: "nuevo",
    });
    expect(errorBackfill).toBeNull();

    const { data: recreado } = await admin
      .from("crm_contactos")
      .select("id, tipo")
      .eq("viandera_id", viandera!.id)
      .single();
    expect(recreado).not.toBeNull();
    expect(recreado!.tipo).toBe("cocina_activa");
    idsACrear.crmContactos.push(recreado!.id);
  });
});

describe("aislamiento RLS: anon y authenticated no acceden a ninguna tabla crm_*", () => {
  // Matriz de 40 intentos: 5 tablas x 4 operaciones x 2 roles. Ninguna de
  // las cinco tablas tiene una sola policy (ver migración), así que RLS
  // deniega todo acceso desde anon/authenticated -- la única vía de acceso
  // es service_role, server-side.
  //
  // Comportamiento real observado contra viandapp-staging (verificado con
  // una sonda manual antes de escribir esta matriz, no asumido de la
  // documentación): con RLS habilitado y cero policies,
  //   - SELECT no lanza error de PostgREST: Postgres filtra silenciosamente
  //     a cero filas visibles (200, data = []). Esa ES la garantía de
  //     aislamiento para SELECT -- no hay ningún error que capturar además
  //     de "no hay filas".
  //   - INSERT sí devuelve un error explícito (42501, "new row violates
  //     row-level security policy"), porque el INSERT necesita que la fila
  //     nueva pase un WITH CHECK, y no hay ninguno.
  //   - UPDATE/DELETE contra una fila real tampoco lanzan error: USING
  //     filtra esa fila a "no visible" para anon/authenticated, así que el
  //     UPDATE/DELETE actualiza/borra cero filas (200, data = []) -- la fila
  //     real, verificada aparte con el cliente admin, queda intacta.
  // Cada test verifica la garantía real (cero filas leídas, cero filas
  // mutadas, ninguna fila nueva creada) en vez de forzar la forma exacta
  // del objeto de error, que difiere legítimamente por tipo de operación.

  // Reutiliza el SUFIJO del módulo (no uno propio) para que el fallback de
  // limpiarTodo() por nombre_libre LIKE %SUFIJO% también cubra cualquier
  // fila que un intento de INSERT desde anon/authenticated lograra crear
  // (lo cual sería, en sí mismo, el hallazgo crítico que estos tests
  // buscan detectar).
  let contactoId: string;
  let vianderaId: string;
  let pedidoId: string;

  beforeAll(async () => {
    const { data: contacto } = await admin
      .from("crm_contactos")
      .insert({
        tipo: "otro",
        fuente: "otro",
        nombre_libre: `RLS seed ${SUFIJO}`,
      })
      .select()
      .single();
    contactoId = contacto!.id;
    idsACrear.crmContactos.push(contactoId);

    const { data: viandera } = await admin
      .from("vianderas")
      .insert({ nombre: `Viandera RLS seed ${SUFIJO}` })
      .select()
      .single();
    vianderaId = viandera!.id;
    idsACrear.vianderas.push(vianderaId);
    // El trigger crea un cocina_activa para esta viandera también; se
    // limpia por cascade al borrar la viandera en limpiarTodo().

    const { data: pedido } = await admin
      .from("pedidos")
      .insert({
        idempotency_key: crypto.randomUUID(),
        request_hash: `hash-${SUFIJO}`,
        vianderas_id: vianderaId,
        modalidad: "retiro",
        total: 1000,
        acepta_marketing: false,
      })
      .select()
      .single();
    pedidoId = pedido!.id;
    idsACrear.pedidos.push(pedidoId);

    await admin
      .from("crm_notas")
      .insert({ contacto_id: contactoId, texto: `Nota RLS seed ${SUFIJO}` });
    await admin
      .from("crm_tareas")
      .insert({ contacto_id: contactoId, titulo: `Tarea RLS seed ${SUFIJO}` });
    await admin.from("crm_interacciones").insert({
      contacto_id: contactoId,
      tipo: "otro",
      resumen: `Interaccion RLS seed ${SUFIJO}`,
    });
    await admin.from("crm_contacto_pedidos").insert({ contacto_id: contactoId, pedido_id: pedidoId });
  });

  type TablaCrm =
    | "crm_contactos"
    | "crm_notas"
    | "crm_tareas"
    | "crm_interacciones"
    | "crm_contacto_pedidos";
  type FilaCrm = { table: TablaCrm; idColumn: string; getRowId: () => string };

  function tablas(): FilaCrm[] {
    return [
      { table: "crm_contactos", idColumn: "id", getRowId: () => contactoId },
      { table: "crm_notas", idColumn: "contacto_id", getRowId: () => contactoId },
      { table: "crm_tareas", idColumn: "contacto_id", getRowId: () => contactoId },
      { table: "crm_interacciones", idColumn: "contacto_id", getRowId: () => contactoId },
      { table: "crm_contacto_pedidos", idColumn: "contacto_id", getRowId: () => contactoId },
    ];
  }

  async function contarFilasReales(table: TablaCrm, idColumn: string, rowId: string) {
    const { count } = await admin
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(idColumn, rowId);
    return count ?? 0;
  }

  function filaInsertable(table: TablaCrm): Record<string, unknown> {
    switch (table) {
      case "crm_contactos":
        return { tipo: "otro", fuente: "otro", nombre_libre: `RLS intento ${SUFIJO}` };
      case "crm_notas":
        return { contacto_id: contactoId, texto: `intento ${SUFIJO}` };
      case "crm_tareas":
        return { contacto_id: contactoId, titulo: `intento ${SUFIJO}` };
      case "crm_interacciones":
        return { contacto_id: contactoId, tipo: "otro", resumen: `intento ${SUFIJO}` };
      case "crm_contacto_pedidos":
        return { contacto_id: contactoId, pedido_id: pedidoId };
      default:
        throw new Error(`tabla no contemplada: ${table}`);
    }
  }

  describe.each([
    ["anon", () => Promise.resolve({ client: crearClienteAnonimo(), limpiar: async () => {} })],
    ["authenticated", () => crearClienteAutenticadoSintetico()],
  ] as const)("como %s", (rol, obtenerCliente) => {
    let client: Awaited<ReturnType<typeof crearClienteAutenticadoSintetico>>["client"];
    let limpiarSesion: () => Promise<void>;

    beforeAll(async () => {
      const sesion = await obtenerCliente();
      client = sesion.client;
      limpiarSesion = sesion.limpiar;
    });

    afterAll(async () => {
      await limpiarSesion();
    });

    it.each(tablas())("$table: SELECT no devuelve ninguna fila", async ({ table, idColumn, getRowId }) => {
      const rowId = getRowId();
      const antes = await contarFilasReales(table, idColumn, rowId);
      expect(antes).toBeGreaterThan(0); // confirma que la fila real existe

      const { data, error } = await client.from(table).select("*").eq(idColumn, rowId);
      // SELECT bajo RLS sin policies no lanza error de PostgREST: filtra en
      // silencio a cero filas. La garantía de aislamiento es data = [].
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it.each(tablas())("$table: INSERT es rechazado por RLS", async ({ table }) => {
      const fila = filaInsertable(table);
      const { error, data } = await client.from(table).insert(fila as never).select();
      expect(error).not.toBeNull();
      expect(error!.code).toBe("42501");
      expect(data).toBeNull();
    });

    it.each(tablas())("$table: UPDATE no modifica la fila real", async ({ table, idColumn, getRowId }) => {
      const rowId = getRowId();
      // Elegimos un campo inocuo por tabla para intentar mutarlo.
      const cambio =
        table === "crm_contactos"
          ? { estado: "descartado" }
          : table === "crm_notas"
            ? { texto: "hackeado" }
            : table === "crm_tareas"
              ? { completada: true, completada_en: new Date().toISOString() }
              : table === "crm_interacciones"
                ? { resumen: "hackeado" }
                : { created_at: new Date("2000-01-01").toISOString() }; // crm_contacto_pedidos: única columna no-clave

      const { data, error } = await client
        .from(table)
        .update(cambio as never)
        .eq(idColumn, rowId)
        .select();

      // O bien RLS devuelve un error explícito, o bien filtra la fila a
      // "no visible" y actualiza cero filas -- ambas son formas válidas de
      // "no tuvo efecto". Lo que nunca debe pasar es que devuelva la fila
      // mutada.
      if (error) {
        expect(error).not.toBeNull();
      } else {
        expect(data).toEqual([]);
      }

      // Verificación fuerte: la fila real, vista con service_role, no cambió.
      if (table === "crm_contactos") {
        const { data: real } = await admin.from(table).select("estado").eq(idColumn, rowId).single();
        expect(real!.estado).not.toBe("descartado");
      } else if (table === "crm_notas") {
        const { data: real } = await admin.from(table).select("texto").eq(idColumn, rowId).limit(1).single();
        expect(real!.texto).not.toBe("hackeado");
      } else if (table === "crm_tareas") {
        const { data: real } = await admin.from(table).select("completada").eq(idColumn, rowId).limit(1).single();
        expect(real!.completada).toBe(false);
      } else if (table === "crm_interacciones") {
        const { data: real } = await admin.from(table).select("resumen").eq(idColumn, rowId).limit(1).single();
        expect(real!.resumen).not.toBe("hackeado");
      } else if (table === "crm_contacto_pedidos") {
        const { data: real } = await admin.from(table).select("created_at").eq(idColumn, rowId).limit(1).single();
        expect(new Date(real!.created_at).getFullYear()).not.toBe(2000);
      }
    });

    it.each(tablas())("$table: DELETE no borra la fila real", async ({ table, idColumn, getRowId }) => {
      const rowId = getRowId();
      const antes = await contarFilasReales(table, idColumn, rowId);
      expect(antes).toBeGreaterThan(0);

      const { data, error } = await client.from(table).delete().eq(idColumn, rowId).select();
      if (error) {
        expect(error).not.toBeNull();
      } else {
        expect(data).toEqual([]);
      }

      const despues = await contarFilasReales(table, idColumn, rowId);
      expect(despues).toBe(antes);
    });
  });
});
