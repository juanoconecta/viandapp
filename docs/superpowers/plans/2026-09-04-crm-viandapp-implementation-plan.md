# CRM integrado de ViandApp — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL:
> `superpowers:subagent-driven-development` o `superpowers:executing-plans`.

**Tercera revisión correctiva — 2026-09-05.** Sustituye por completo las
revisiones anteriores de este plan. Corrige la normalización telefónica,
los privilegios de los triggers, el backfill, las constraints de
anonimización, la vista sin fallback a pedidos, la reactivación por nuevo
consentimiento y la arquitectura del administrador integrado.

**Objetivo:** convertir `/admin` en el tablero general de ViandApp y sumar
un CRM privado para un único administrador, con contactos, notas, tareas,
interacciones, pedidos vinculados y gestión segura del consentimiento.

**Arquitectura:** el CRM vive en la aplicación Next.js y el proyecto
Supabase de ViandApp. Cinco tablas con RLS y cero policies se consultan
exclusivamente mediante Server Actions/servicios que verifican
`ADMIN_EMAIL` y luego usan `service_role`. Triggers idempotentes incorporan
interesados, cocinas y consumidores consentidos sin abrir las tablas CRM al
cliente público.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript, Supabase
Postgres/PL/pgSQL, Vitest, Tailwind CSS 4.

**Spec aprobada:**
`docs/superpowers/specs/2026-09-04-crm-viandapp-design.md`

**Dependencia bloqueante:** implementar y validar primero
`docs/superpowers/plans/2026-09-04-carrito-pedidos-whatsapp-implementation-plan.md`.
La migración CRM referencia `pedidos`; no se puede aplicar antes.

## Reglas de ejecución

- Trabajar con TDD: test rojo, implementación mínima, test verde, commit.
- Leer antes de programar las guías relevantes de Next.js 16 en
  `node_modules/next/dist/docs/`, especialmente App Router, Server Actions,
  `redirect` y `revalidatePath`.
- Usar `viandapp-staging` y datos sintéticos para toda prueba de base.
- Nunca copiar usuarios ni PII de producción a staging.
- No agregar dependencias npm.
- Detenerse y pedir autorización antes de aplicar **cada** migración,
  incluso en staging.
- La autorización para staging no autoriza producción.
- Detenerse nuevamente antes de aplicar en producción.
- Generar una vista previa y detenerse antes de `git push`, merge o
  publicación. La migración y la publicación son gates independientes.

---

### Task 0: Cerrar la infraestructura de integración y la dependencia de pedidos

**Files:**
- Modify: `docs/superpowers/plans/2026-09-04-carrito-pedidos-whatsapp-implementation-plan.md`
- Create: `.env.integration.example`
- Create: `vitest.integration.config.ts`
- Create: `lib/testing/clienteIntegracion.ts`
- Create: `lib/testing/clienteIntegracion.test.ts`
- Create: `docs/testing-integracion.md`
- Modify: `package.json`

**Paso 1 — fijar la decisión ya aprobada.** En Task 0 del plan de
Carrito/Pedidos eliminar la bifurcación Docker/staging y dejar como único
camino `viandapp-staging`. Documentar que el proyecto gratuito puede
pausarse sin afectar producción y debe reactivarse antes de los tests.

**Paso 2 — escribir primero tests del guard de entorno.** Probar que
`crearClienteIntegracion()` rechaza si falta alguna variable, si la URL
coincide con `NEXT_PUBLIC_SUPABASE_URL`, o si
`INTEGRATION_ALLOW_REMOTE_DATABASE !== "viandapp-staging"`.

```ts
// lib/testing/clienteIntegracion.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export function validarEntornoIntegracion(env = process.env) {
  const url = env.INTEGRATION_SUPABASE_URL;
  const key = env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Faltan credenciales de integración.");
  if (url === env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("La base de integración no puede ser producción.");
  }
  if (env.INTEGRATION_ALLOW_REMOTE_DATABASE !== "viandapp-staging") {
    throw new Error("Staging remoto no autorizado para tests.");
  }
  return { url, key };
}

export function crearClienteIntegracion(env = process.env) {
  const { url, key } = validarEntornoIntegracion(env);
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

**Paso 3 — configurar Vitest.** `vitest.integration.config.ts` incluye
solo `**/*.integration.test.ts`, usa entorno `node`, `fileParallelism:
false` y timeout de 30 segundos. Agregar
`"test:integration": "vitest run --config vitest.integration.config.ts"`.
`.env.integration.example` contiene únicamente nombres de variables y
valores ficticios.

**Paso 4 — documentar el flujo.** `docs/testing-integracion.md` debe
explicar reactivación de staging, carga local de secretos no versionados,
datos sintéticos, limpieza por IDs generados por cada test y la prohibición
de usar producción.

**Paso 5 — ejecutar unitarios.** Ejecutar
`npm test -- lib/testing/clienteIntegracion.test.ts` y confirmar rojo antes
de la implementación y verde después.

**Paso 6 — confirmar dependencia.** No continuar a Task 1 hasta que la
migración de Carrito/Pedidos esté autorizada, aplicada y validada en
staging. Registrar el commit y la fecha en `docs/testing-integracion.md`.

**Paso 7 — commit.**

```bash
git add .env.integration.example vitest.integration.config.ts lib/testing/clienteIntegracion.ts lib/testing/clienteIntegracion.test.ts docs/testing-integracion.md package.json docs/superpowers/plans/2026-09-04-carrito-pedidos-whatsapp-implementation-plan.md
git commit -m "test: fix integration environment to isolated Supabase staging"
```

---

### Task 1: Normalización y reglas de vínculo con TDD

**Files:**
- Create: `lib/crm/normalizarContacto.ts`
- Create: `lib/crm/normalizarContacto.test.ts`
- Create: `lib/crm/vinculo.ts`
- Create: `lib/crm/vinculo.test.ts`

**Paso 1 — tests rojos de normalización.** Usar una tabla con estas
salidas exactas:

```ts
import { describe, expect, it } from "vitest";
import { normalizarContacto } from "./normalizarContacto";

describe("normalizarContacto", () => {
  it.each([
    [null, null],
    ["", null],
    ["sin telefono", null],
    [" Maria@Ejemplo.COM ", "maria@ejemplo.com"],
    ["3548 635151", "3548635151"],
    ["+54 3548 635151", "3548635151"],
    ["+54 9 3548-635151", "3548635151"],
    ["11-2345", "112345"],
  ])("normaliza %s", (entrada, esperado) => {
    expect(normalizarContacto(entrada)).toBe(esperado);
  });
});
```

**Paso 2 — implementación mínima.**

```ts
export function normalizarContacto(valor: string | null): string | null {
  if (valor === null) return null;
  if (valor.includes("@")) return valor.trim().toLowerCase() || null;

  const digitos = valor.replace(/[^0-9]/g, "");
  if (/^549[0-9]{10}$/.test(digitos)) return digitos.slice(3);
  if (/^54[0-9]{10}$/.test(digitos)) return digitos.slice(2);
  return digitos || null;
}
```

**Paso 3 — tests rojos de vínculo.** Cubrir exactamente: acepta un
`vianderaId`; acepta un `interesadoId`; acepta `nombreLibre`; rechaza dos
FK simultáneas; rechaza fila libre sin nombre; acepta fila anónima solo si
`tipo === "consumidor"`, sin FK, sin nombre/contacto y con consentimiento
retirado.

```ts
export type DatosVinculo = {
  tipo: "cocina_potencial" | "cocina_activa" | "consumidor" |
    "aliado_estrategico" | "otro";
  vianderaId?: string | null;
  interesadoId?: string | null;
  nombreLibre?: string | null;
  contactoLibre?: string | null;
  consentimientoRetiradoEn?: string | null;
  piiEliminada?: boolean;
};

export type ResultadoValidacion =
  | { ok: true }
  | { ok: false; mensaje: string };

export function validarVinculo(datos: DatosVinculo): ResultadoValidacion;
```

**Paso 4 — implementar `validarVinculo`.** Debe reflejar literalmente las
constraints SQL de Task 2 y devolver mensajes de dominio, no lanzar.

**Paso 5 — verificar.** Ejecutar
`npm test -- lib/crm/normalizarContacto.test.ts lib/crm/vinculo.test.ts`.

**Paso 6 — commit.**

```bash
git add lib/crm
git commit -m "feat: add tested CRM contact normalization and link rules"
```

---

### Task 2: Escribir la migración CRM y los tipos — sin aplicarla

**Files:**
- Create: `supabase/migrations/202609050001_crm_integrado.sql`
- Modify: `types/index.ts`

**Paso 1 — escribir la migración completa.** La migración debe ser una
transacción aditiva con este orden:

1. Crear `public.crm_normalizar_contacto(p_contacto_libre text)` como
   función SQL `immutable` con exactamente la misma tabla de casos de
   Task 1. Usar `nullif(lower(trim(...)), '')`; para teléfonos quitar no
   dígitos y remover `549`/`54` solo si restan diez dígitos nacionales.
2. Crear `crm_contactos`, `crm_contacto_pedidos`, `crm_notas`,
   `crm_tareas`, `crm_interacciones` con columnas y checks de la spec.
3. Crear índices únicos parciales para `viandera_id`, `interesado_id` y
   `(tipo, contacto_normalizado)` de consumidores no nulos.
4. Habilitar RLS en las cinco tablas y no crear policies.
5. Crear el trigger `crm_contactos_set_updated_at` usando
   `public.viandapp_set_updated_at()`.
6. Crear triggers de interesado, viandera y pedido consentido.
7. Ejecutar backfill idempotente de interesados y vianderas existentes.
8. Crear la vista `crm_contactos_resumen` con `security_invoker = true`.
9. Cerrar con `commit`.

Las dos constraints de privacidad de `crm_contactos` deben ser estas:

```sql
constraint crm_contactos_libre_o_vinculado check (
  viandera_id is not null
  or interesado_id is not null
  or nombre_libre is not null
  or pii_eliminada = true
),
constraint crm_contactos_anonimizacion_consistente check (
  pii_eliminada = false
  or (
    tipo = 'consumidor'
    and viandera_id is null
    and interesado_id is null
    and nombre_libre is null
    and contacto_libre is null
    and consentimiento_retirado_en is not null
  )
)
```

Cada función trigger debe declarar:

```sql
language plpgsql
security definer
set search_path = ''
```

Todos los nombres de tabla deben estar calificados con `public.`. Después
de cada función revocar ejecución directa:

```sql
revoke all on function public.crm_sincronizar_interesado()
from public, anon, authenticated;
revoke all on function public.crm_sincronizar_viandera()
from public, anon, authenticated;
revoke all on function public.crm_vincular_pedido_consentido()
from public, anon, authenticated;
```

El `upsert` del consumidor debe restaurar consentimiento solo en la fila
no anonimizada que entra en conflicto:

```sql
on conflict (tipo, contacto_normalizado)
  where tipo = 'consumidor' and contacto_normalizado is not null
do update set
  nombre_libre = excluded.nombre_libre,
  contacto_libre = excluded.contacto_libre,
  consentimiento_retirado_en = null,
  pii_eliminada = false
returning id into v_contacto_id;
```

La vista no puede unir `pedidos` para resolver PII. Sus campos visibles
deben usar esta lógica:

```sql
case when c.pii_eliminada then null
  else coalesce(v.nombre, i.nombre, c.nombre_libre)
end as nombre,
case when c.pii_eliminada then null
  else coalesce(v.telefono, i.contacto, c.contacto_libre)
end as contacto
```

**Paso 2 — agregar tipos públicos.** Incorporar `EstadoPedido` y `Pedido`
desde el plan de Carrito/Pedidos si todavía no existen; luego definir
`TipoCrmContacto`, `FuenteCrmContacto`, `EstadoCrmContacto`,
`TipoCrmInteraccion`, `CrmContacto`, `CrmContactoResumen`, `CrmNota`,
`CrmTarea`, `CrmInteraccion` y `CrmContactoPedido`. Agregar las cinco
tablas y la vista al tipo `Database`, con `Insert`, `Update` y
`Relationships` coherentes. No usar `any`.

**Paso 3 — validación estática.** Ejecutar `npm test` y `npm run lint`.
No aplicar la migración para hacer pasar tests en este paso.

**Paso 4 — revisión de seguridad por lectura.** Confirmar en el archivo:
cinco `enable row level security`, cero `create policy`, tres
`security definer`, tres `set search_path = ''`, tres revocaciones,
dos backfills y ninguna unión de la vista con `pedidos`.

**Paso 5 — commit de migración escrita, no aplicada.**

```bash
git add supabase/migrations/202609050001_crm_integrado.sql types/index.ts
git commit -m "feat: define isolated CRM schema and consent synchronization"
```

**GATE DE MIGRACIÓN 1:** detenerse, informar que el SQL está escrito pero
no aplicado y solicitar autorización explícita para aplicarlo en
`viandapp-staging`. No ejecutar Dashboard SQL, `supabase db push` ni una
conexión SQL antes de esa autorización.

---

### Task 3: Aplicar solo a staging y probar garantías de base

**Files:**
- Create: `app/admin/crm/sincronizacion.integration.test.ts`
- Create: `app/admin/crm/consentimiento.integration.test.ts`

**Precondición:** el usuario autorizó explícitamente la migración CRM en
staging después del gate de Task 2.

**Paso 1 — aplicar una sola vez a staging.** Verificar visualmente el ref
del proyecto antes de ejecutar. Debe ser el ref de `viandapp-staging` y no
`xnypgoqswvnpikkxhwnf` (producción). Registrar comando, hora y resultado en
`docs/testing-integracion.md`.

**Paso 2 — escribir tests de sincronización.** Crear datos sintéticos con
un sufijo UUID y limpiar exclusivamente esos IDs. Probar:

- insertar un interesado como `anon` crea un contacto
  `cocina_potencial` aunque anon no tenga acceso directo al CRM;
- volver a ejecutar la función sobre la misma fila no duplica;
- una viandera nueva crea un contacto `cocina_activa`;
- interesados y vianderas previos a la migración aparecen por backfill;
- anon y authenticated no pueden seleccionar, insertar, actualizar ni
  borrar en ninguna de las cinco tablas CRM;
- `pg_policies` devuelve cero filas para tablas `crm_%`;
- las tres funciones no tienen `PUBLIC`, `anon` ni `authenticated` con
  privilegio de ejecución directa.

**Paso 3 — escribir tests de consentimiento.** Probar:

- pedido con `acepta_marketing = true` crea consumidor y puente;
- `3548 635151`, `+54 3548 635151` y `+54 9 3548-635151` producen un solo
  contacto y tres puentes;
- pedido con `acepta_marketing = false` no crea contacto;
- retirar consentimiento conserva contacto/puentes y marca timestamp;
- un pedido consentido posterior reactiva una fila no anonimizada;
- anonimizar nullea PII, conserva puentes y la vista devuelve nombre y
  contacto nulos aunque el pedido todavía retenga PII;
- consentimiento nuevo después de anonimizar crea otro contacto y deja
  intacta la fila anónima anterior.

**Paso 4 — confirmar paridad SQL/TypeScript.** Para cada entrada tabular de
Task 1, comparar `normalizarContacto(entrada)` con
`select public.crm_normalizar_contacto(entrada)`.

**Paso 5 — ejecutar integración.** Ejecutar `npm run test:integration` y
guardar el resumen, sin secretos, en `docs/testing-integracion.md`.

**Paso 6 — commit.**

```bash
git add app/admin/crm/*.integration.test.ts docs/testing-integracion.md
git commit -m "test: verify CRM isolation synchronization and consent in staging"
```

---

### Task 4: Servicios y Server Actions admin-only con TDD

**Files:**
- Create: `lib/crm/consultas.ts`
- Create: `lib/crm/consultas.test.ts`
- Create: `app/admin/crm/actions.ts`
- Create: `app/admin/crm/actions.test.ts`

**Paso 1 — definir contratos.**

```ts
export type ResultadoAccion =
  | { status: "idle" }
  | { status: "ok"; mensaje?: string }
  | { status: "error"; mensaje: string };

export type FiltrosCrm = {
  busqueda?: string;
  tipo?: TipoCrmContacto;
  estado?: EstadoCrmContacto;
  consentimiento?: "vigente" | "retirado" | "anonimizado";
};
```

`lib/crm/consultas.ts` importa `server-only` y exporta
`obtenerResumenAdmin()`, `listarContactos(filtros)` y
`obtenerDetalleContacto(id)`. El detalle reúne contacto/vista, notas,
tareas, interacciones y pedidos puente; nunca reconstruye PII desde un
pedido.

**Paso 2 — tests rojos de consultas.** Mockear `createAdminClient` y
probar filtros exactos, orden por `updated_at desc`, conteos del tablero y
que `obtenerDetalleContacto` no selecciona `nombre_comprador` ni
`telefono_comprador` para exhibir identidad.

**Paso 3 — implementar consultas mínimas** hasta dejar esos tests verdes.

**Paso 4 — tests rojos de Actions.** Cubrir cada acción sin admin y su
escritura autorizada:

- `crearContactoLibre`: solo `aliado_estrategico` u `otro`, valida
  `nombre_libre` y no acepta `pedidoId`;
- `actualizarEstadoContacto`: valida el enum;
- `vincularPedidoManualmente`: inserta únicamente
  `{ contacto_id, pedido_id }`; la firma no recibe PII;
- `retirarConsentimiento`: actualiza con `.eq("tipo", "consumidor")` y
  falla si no retorna una fila;
- `anonimizarContacto`: usa el mismo filtro de tipo, nullea ambos campos,
  marca `pii_eliminada` y consentimiento retirado;
- `agregarNota`: texto trim de 1–2000;
- `crearTarea`: título trim de 1–200 y fecha ISO opcional;
- `completarTarea`: escribe `completada=true` y timestamp;
- `registrarInteraccion`: valida tipo y resumen de 1–1000.

**Paso 5 — implementar autenticación uniforme.** Al comienzo de cada
acción: `createClient()`, `auth.getUser()`, `esAdmin(user?.email)`. Crear
`createAdminClient()` solo después de autorizar. Devolver mensajes de
dominio; no propagar errores de Supabase ni secretos. Revalidar
`/admin`, `/admin/crm` y el detalle afectado.

**Paso 6 — verificar.** Ejecutar
`npm test -- lib/crm/consultas.test.ts app/admin/crm/actions.test.ts` y
`npm run lint -- lib/crm app/admin/crm`.

**Paso 7 — commit.**

```bash
git add lib/crm/consultas.ts lib/crm/consultas.test.ts app/admin/crm/actions.ts app/admin/crm/actions.test.ts
git commit -m "feat: add admin-only CRM queries and actions"
```

---

### Task 5: Reorganizar el administrador y separar Puni

**Files:**
- Create: `lib/admin/navegacion.ts`
- Create: `lib/admin/navegacion.test.ts`
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/page.tsx`
- Create: `app/admin/puni/page.tsx`
- Create: `app/admin/pedidos/page.tsx`
- Modify: `components/admin/TarjetaSolicitudPuni.tsx`

**Paso 1 — test rojo de navegación.** `itemsAdmin` debe contener, en este
orden: Inicio `/admin`, CRM `/admin/crm`, Pedidos `/admin/pedidos`, Puni
`/admin/puni`. Probar que las rutas son únicas y empiezan con `/admin`.

**Paso 2 — layout compartido.** Ampliar a `max-w-6xl`; agregar encabezado
“Administración de ViandApp”, navegación responsive y Cerrar sesión.
Mantener autenticación en las páginas; no confiar solo en ocultar links.

**Paso 3 — tablero `/admin`.** Reemplazar el listado mixto por cuatro
tarjetas: contactos nuevos, tareas vencidas, pedidos de los últimos siete
días y solicitudes Puni pendientes. Conservar `FormularioInvitar` en una
sección “Alta de cocina” porque invita a la plataforma, no a Puni.

**Paso 4 — mover Puni.** `/admin/puni` contiene la consulta y tarjetas de
adhesión que hoy están en `/admin`. `TarjetaSolicitudPuni` conserva la
acción existente `resolverAdhesionPuni`; no se cambia el permiso ni el
modelo de costo de envío.

**Paso 5 — pedidos admin.** `/admin/pedidos` lista pedidos recientes con
cocina, modalidad, total, estado y fecha. Es lectura global admin; el
cambio de estado sigue usando las transiciones definidas por el plan de
Pedidos.

**Paso 6 — verificar.** Ejecutar el test de navegación, suite completa y
lint.

**Paso 7 — commit.**

```bash
git add lib/admin app/admin components/admin/TarjetaSolicitudPuni.tsx
git commit -m "feat: turn admin into dashboard with CRM orders and Puni modules"
```

---

### Task 6: Construir listado y detalle del CRM

**Files:**
- Create: `app/admin/crm/page.tsx`
- Create: `app/admin/crm/[id]/page.tsx`
- Create: `components/admin/crm/ListaContactos.tsx`
- Create: `components/admin/crm/DetalleContacto.tsx`
- Create: `components/admin/crm/FormularioContacto.tsx`
- Create: `components/admin/crm/FormularioNota.tsx`
- Create: `components/admin/crm/FormularioTarea.tsx`
- Create: `components/admin/crm/FormularioInteraccion.tsx`
- Create: `components/admin/crm/EstadoConsentimiento.tsx`
- Create: `components/admin/crm/EstadoConsentimiento.test.tsx`

**Paso 1 — test rojo del estado de consentimiento.** Renderizar con
`react-dom/server` y probar estas etiquetas: consumidor vigente
“Consentimiento vigente”; retirado “Consentimiento retirado”; anonimizado
“Datos anonimizados”; cocina/aliado no muestra controles de consumidor.

**Paso 2 — listado.** `/admin/crm` valida admin, acepta `searchParams` de
búsqueda/tipo/estado/consentimiento, llama `listarContactos` y muestra
tabla en escritorio y tarjetas en móvil. Cada fila enlaza al detalle.
Incluir CTA “Nuevo aliado u otro contacto”.

**Paso 3 — detalle.** `/admin/crm/[id]` valida admin y usa `notFound()` si
no existe. Mostrar identidad desde `crm_contactos_resumen`, fuente,
estado, etiquetas, consentimiento, notas, tareas, interacciones y pedidos
vinculados. Si está anonimizado, mostrar “Contacto anónimo” y nunca datos
del pedido como identidad.

**Paso 4 — formularios.** Usar Server Actions de Task 4. Mostrar estados
pending/error/success. Antes de notas e interacciones mostrar: “No incluyas
datos sensibles que no sean necesarios para la gestión comercial.” Los
botones Retirar/Anonimizar solo aparecen para consumidores y piden
confirmación explícita en la interfaz.

**Paso 5 — responsive y accesibilidad.** Verificar foco visible, labels,
errores asociados, contraste y navegación por teclado a 375, 768, 1024 y
1440 px.

**Paso 6 — verificar.** Ejecutar test dirigido, `npm test`, `npm run lint`
y `npm run build`.

**Paso 7 — commit.**

```bash
git add app/admin/crm components/admin/crm
git commit -m "feat: add responsive CRM contact list and detail"
```

---

### Task 7: QA integral, preview y gates de producción

**Files:**
- Modify: `docs/testing-integracion.md`
- Create: `docs/qa/2026-09-05-crm-admin.md`

**Paso 1 — verificación automatizada.** Ejecutar en este orden:

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

Registrar comandos, cantidad de tests, resultado y fecha. No copiar claves
ni datos personales al documento.

**Paso 2 — QA manual local.** Con usuario admin sintético verificar
`/admin`, `/admin/crm`, un detalle, `/admin/pedidos` y `/admin/puni`.
Confirmar estados vacíos, error, carga y datos. Confirmar que un usuario no
admin redirige a `/app` en cada ruta.

**Paso 3 — QA de privacidad.** Verificar que la ficha anonimizada no
muestra nombre/teléfono aunque el pedido siga reteniéndolos; que no existe
botón de marketing/envío masivo; que retiro y anonimización solo aceptan
consumidores; y que las notas muestran la advertencia.

**Paso 4 — generar vista previa.** Levantar la app local, cargar solo datos
sintéticos y entregar al usuario la URL local y capturas del tablero,
listado y detalle. Incorporar ajustes solicitados y repetir unitarios,
lint y build.

**GATE DE MIGRACIÓN 2:** detenerse y pedir autorización explícita antes de
aplicar `202609050001_crm_integrado.sql` a producción. Antes de pedirla,
reportar backup/preflight, resultado de staging, RLS/privilegios y plan de
reversión. No interpretar una autorización de preview como autorización
de migración.

**Paso 5 — smoke test productivo.** Solo después de autorización y
aplicación exitosa: comprobar como admin que backfill, conteos y detalle
funcionan; comprobar como anon que el formulario público de interés sigue
insertando y que el CRM derivado no es legible.

**GATE DE PUBLICACIÓN:** detenerse otra vez con la preview visible y pedir
autorización explícita antes de `git push`, merge o despliegue de la web.

**Paso 6 — publicar y canary.** Solo tras esa autorización: publicar,
comprobar `https://www.viandapp.ar/admin`, navegación, login, CRM, pedidos
y Puni; registrar resultado en el documento de QA.

**Paso 7 — commit documental.**

```bash
git add docs/testing-integracion.md docs/qa/2026-09-05-crm-admin.md
git commit -m "docs: record CRM staging production and release verification"
```

## Criterios de terminado

- `/admin` es el tablero general y Puni vive en `/admin/puni`.
- Solo `ADMIN_EMAIL` puede leer o mutar el CRM.
- RLS está activo en cinco tablas CRM y no hay policies.
- El alta pública de interesados sigue operativa mediante trigger seguro.
- Backfill y sincronización son idempotentes.
- Consumidores sin marketing no generan PII durable en CRM.
- Los tres formatos argentinos definidos deduplican al mismo contacto.
- Retiro, anonimización y consentimiento nuevo cumplen la spec.
- La vista jamás reconstruye PII desde pedidos.
- Unitarios, integración, lint y build pasan.
- Staging, producción y publicación tienen autorizaciones separadas y
  registradas.
