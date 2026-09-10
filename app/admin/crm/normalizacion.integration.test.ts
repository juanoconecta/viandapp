import { describe, expect, it } from "vitest";
import { crearClienteIntegracion } from "@/lib/testing/clienteIntegracion";
import { normalizarContacto } from "@/lib/crm/normalizarContacto";

// Cubre el Paso 4 del plan de CRM (Task 3): confirma que la función SQL
// public.crm_normalizar_contacto (viva en viandapp-staging, columna
// generada de crm_contactos.contacto_normalizado) produce exactamente el
// mismo resultado que normalizarContacto() en lib/crm/normalizarContacto.ts
// (Task 1) para CADA entrada de la tabla de test de Task 1
// (lib/crm/normalizarContacto.test.ts) -- no un subconjunto.
//
// No crea ni modifica ninguna fila: crm_normalizar_contacto es
// `language sql immutable`, sin efectos secundarios, así que este archivo
// no necesita limpieza.

const admin = crearClienteIntegracion();

// Misma tabla exacta que lib/crm/normalizarContacto.test.ts.
const casos: Array<[string | null, string | null]> = [
  [null, null],
  ["", null],
  ["sin telefono", null],
  [" Maria@Ejemplo.COM ", "maria@ejemplo.com"],
  ["3548 635151", "3548635151"],
  ["+54 3548 635151", "3548635151"],
  ["+54 9 3548-635151", "3548635151"],
  ["11-2345", "112345"],
];

describe("paridad SQL/TypeScript: crm_normalizar_contacto vs normalizarContacto", () => {
  it.each(casos)("normaliza %s igual en SQL y en TypeScript", async (entrada, esperado) => {
    const esperadoTs = normalizarContacto(entrada);
    expect(esperadoTs).toBe(esperado);

    const { data: resultadoSql, error } = await admin.rpc("crm_normalizar_contacto", {
      p_contacto_libre: entrada,
    });

    expect(error).toBeNull();
    expect(resultadoSql).toBe(esperado);
    expect(resultadoSql).toBe(esperadoTs);
  });
});
