# ViandApp Consumer Explorer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar una entrega medible donde una persona explore viandas reales en `/explorar`, abra el perfil público de una viandera y continúe a WhatsApp sin registrarse.

**Architecture:** Se mantiene `/` como landing de captación. `/explorar` será una página pública server-rendered cuyos filtros viven en la URL. Las consultas, el cálculo de filtros y la analítica quedan aislados en `lib/`; los componentes interactivos se limitan a búsqueda, filtros y confirmación de WhatsApp.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase/Postgres, Vitest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md`

## Global Constraints

- Mantener `/` como landing de captación de vianderas.
- Crear `/explorar`; no crear `/explorar/resultados`.
- No implementar mapa, geolocalización, carrito, checkout, pagos, logística, ratings, favoritos ni cuentas de consumidor.
- No usar “Disponible hoy”; el modelo actual no representa días ni horarios.
- No mostrar sellos de identidad, teléfono, carnet o habilitación que no estén respaldados por datos y procesos reales.
- La exploración y los perfiles son públicos y no requieren registro.
- Usar `coral-action` (`#B84826`) cuando haya texto blanco pequeño sobre fondo coral.
- Texto normal: contraste mínimo WCAG 2.2 AA de 4.5:1.
- Mantener `next dev --webpack` y los workers públicos de MapLibre existentes, aunque el mapa no participe de esta entrega.
- No envolver formularios con `AnimatePresence mode="wait"` ni `motion.form`.
- Cada ruta raíz nueva debe agregarse a `RUTAS_RESERVADAS`.
- No registrar PII en analítica: teléfono, dirección, nombre completo, contenido del mensaje ni identificadores de Auth.

---

## File map

### Create

- `docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md`: copia versionada de la especificación aprobada, recortada al MVP.
- `supabase/migrations/202609030001_explorador_mvp.sql`: campos mínimos y tabla de eventos.
- `vitest.config.ts`: configuración de pruebas unitarias.
- `lib/viandas/filtros.ts`: parseo y serialización de filtros públicos.
- `lib/viandas/consultas.ts`: consultas públicas de exploración.
- `lib/analitica/eventos.ts`: nombres, payload permitido y escritura de eventos.
- `app/explorar/page.tsx`: ruta pública de exploración.
- `app/explorar/loading.tsx`: carga estructural.
- `app/explorar/error.tsx`: error recuperable de ruta.
- `components/consumer/ConsumerShell.tsx`: estructura responsive pública.
- `components/consumer/DesktopSidebar.tsx`: navegación desktop.
- `components/consumer/MobileBottomNav.tsx`: navegación mobile.
- `components/consumer/GlobalSearch.tsx`: búsqueda GET sobre `/explorar`.
- `components/consumer/FilterChips.tsx`: filtros básicos en URL.
- `components/consumer/DishCard.tsx`: plato público.
- `components/consumer/EmptyState.tsx`: vacío accionable.
- `components/consumer/ResultsSkeleton.tsx`: carga sin salto de layout.
- `components/storefront/StorefrontHeader.tsx`: cabecera pública factual.
- `components/storefront/PublicDishCard.tsx`: plato dentro de la vidriera.
- `components/storefront/WhatsAppIntent.tsx`: confirmación y salida medida.
- `components/storefront/StickyContactBar.tsx`: CTA mobile contextual.
- `lib/viandas/filtros.test.ts`: pruebas de filtros.
- `lib/analitica/eventos.test.ts`: pruebas de sanitización de eventos.

### Modify

- `package.json`: scripts de Vitest.
- `package-lock.json`: dependencia de desarrollo.
- `tailwind.config.ts`: tokens funcionales accesibles.
- `types/index.ts`: campos nuevos y tabla de eventos.
- `lib/viandera/slug.ts`: reservar `explorar`.
- `app/[slug]/page.tsx`: composición pública rediseñada.
- `CLAUDE.md`: migración y estado actualizado.

### Remove after replacement

- Ningún archivo en esta entrega. Los stubs `components/viandas/Filtros.tsx` y `ViandaList.tsx` se retiran en un commit posterior solo después de verificar que no tengan consumidores.

---

## Task 1: Versionar el diseño aprobado y preparar pruebas

**Files:**

- Create: `docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: script `npm test`, entorno de tests Node y spec estable para el resto del plan.

- [ ] **Step 1: Copiar y recortar la especificación aprobada**

Copiar desde:

```text
C:\Users\ROLE\Documents\Codex\2026-09-02\referenced-chatgpt-conversation-this-is-an\outputs\viandapp-interface-spec.md
```

Excluir mapa de la entrega inicial, pero conservarlo en una sección “Siguiente entrega”. Incorporar literalmente las decisiones de `Global Constraints`.

- [ ] **Step 2: Instalar Vitest**

Run:

```bash
npm install --save-dev vitest
```

- [ ] **Step 3: Crear la configuración**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

Agregar a `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verificar el baseline**

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Expected: los tres comandos pasan antes de cambios funcionales.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-explorador-consumidores-design.md vitest.config.ts package.json package-lock.json
git commit -m "docs: define consumer explorer MVP"
```

---

## Task 2: Migración mínima y tipos

**Files:**

- Create: `supabase/migrations/202609030001_explorador_mvp.sql`
- Modify: `types/index.ts`
- Modify: `CLAUDE.md`

**Interfaces:**

- Produces: `vianderas.barrio`, `ofrece_retiro`, `ofrece_envio`, `updated_at`; `viandas.updated_at`; tabla `eventos_analitica` insert-only.

- [ ] **Step 1: Escribir la migración**

```sql
alter table public.vianderas
  add column if not exists barrio text,
  add column if not exists ofrece_retiro boolean not null default true,
  add column if not exists ofrece_envio boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.viandas
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vianderas_set_updated_at on public.vianderas;
create trigger vianderas_set_updated_at
before update on public.vianderas
for each row execute function public.set_updated_at();

drop trigger if exists viandas_set_updated_at on public.viandas;
create trigger viandas_set_updated_at
before update on public.viandas
for each row execute function public.set_updated_at();

create table if not exists public.eventos_analitica (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (nombre in (
    'explore_viewed', 'search_submitted', 'filter_applied',
    'profile_viewed', 'dish_selected', 'whatsapp_intent', 'whatsapp_clicked'
  )),
  viandera_id uuid references public.vianderas(id) on delete set null,
  vianda_id uuid references public.viandas(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.eventos_analitica enable row level security;
```

No crear políticas públicas de inserción. Los eventos se escriben únicamente desde una acción de servidor que usa `createAdminClient()` después de sanitizar el payload. Así un visitante no puede insertar PII o eventos arbitrarios llamando Supabase directamente.

- [ ] **Step 2: Actualizar tipos**

Agregar los campos exactos a `Viandera`, `Vianda` y la definición de `eventos_analitica` en `Database`. Definir:

```ts
export type NombreEventoAnalitica =
  | "explore_viewed"
  | "search_submitted"
  | "filter_applied"
  | "profile_viewed"
  | "dish_selected"
  | "whatsapp_intent"
  | "whatsapp_clicked";
```

- [ ] **Step 3: Documentar aplicación manual**

Agregar a `CLAUDE.md` la ruta de la migración, columnas y política. No afirmar que producción está migrada hasta verificarlo.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609030001_explorador_mvp.sql types/index.ts CLAUDE.md
git commit -m "feat: add explorer data model and analytics events"
```

---

## Task 3: Filtros públicos puros y testeados

**Files:**

- Create: `lib/viandas/filtros.ts`
- Test: `lib/viandas/filtros.test.ts`

**Interfaces:**

- Produces:

```ts
export type FiltrosExplorador = {
  q: string;
  tipo: "todos" | "almuerzo" | "cena";
  etiqueta: string | null;
  modalidad: "todas" | "retiro" | "envio";
};

export function parsearFiltros(
  params: Record<string, string | string[] | undefined>,
): FiltrosExplorador;
```

- [ ] **Step 1: Escribir pruebas que fallen**

Cubrir valores por defecto, arrays maliciosos, espacios, límite de 80 caracteres, tipo inválido, etiqueta fuera de `ETIQUETAS_DIETARIAS` y modalidad inválida.

```ts
import { describe, expect, it } from "vitest";
import { parsearFiltros } from "./filtros";

describe("parsearFiltros", () => {
  it("devuelve filtros seguros por defecto", () => {
    expect(parsearFiltros({})).toEqual({
      q: "",
      tipo: "todos",
      etiqueta: null,
      modalidad: "todas",
    });
  });

  it("descarta valores no permitidos", () => {
    expect(parsearFiltros({ tipo: "otro", etiqueta: "inventada", modalidad: "dron" }))
      .toEqual({ q: "", tipo: "todos", etiqueta: null, modalidad: "todas" });
  });
});
```

- [ ] **Step 2: Confirmar que fallan**

Run: `npm test -- lib/viandas/filtros.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar el parser mínimo**

Usar listas permitidas; tomar solo el primer valor si llega un array; normalizar `q` con `trim().slice(0, 80)`; no construir consultas en este archivo.

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- lib/viandas/filtros.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/viandas/filtros.ts lib/viandas/filtros.test.ts
git commit -m "feat: add safe explorer filters"
```

---

## Task 4: Analítica segura antes de construir la UI

**Files:**

- Create: `lib/analitica/eventos.ts`
- Create: `app/actions/analitica.ts`
- Test: `lib/analitica/eventos.test.ts`

**Interfaces:**

- Produces:

```ts
export type EventoPublico = {
  nombre: NombreEventoAnalitica;
  vianderaId?: string;
  viandaId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export function sanitizarEvento(evento: EventoPublico): EventoPublico;
export async function registrarEvento(evento: EventoPublico): Promise<void>;
```

- [ ] **Step 1: Escribir pruebas de privacidad que fallen**

```ts
it("elimina metadata sensible", () => {
  expect(sanitizarEvento({
    nombre: "whatsapp_intent",
    metadata: { telefono: "123", mensaje: "hola", origen: "perfil" },
  }).metadata).toEqual({ origen: "perfil" });
});
```

Cubrir claves prohibidas: `telefono`, `phone`, `direccion`, `address`, `nombre`, `email`, `mensaje`, `message`, `user_id`.

- [ ] **Step 2: Confirmar que fallan**

Run: `npm test -- lib/analitica/eventos.test.ts`

- [ ] **Step 3: Implementar sanitización y escritura best-effort**

`lib/analitica/eventos.ts` debe importar `server-only`. `registrarEvento` usa `createAdminClient()`, captura y registra el error en servidor sin bloquear el recorrido del usuario. Limitar metadata a seis claves conocidas y valores escalares con rangos y valores enumerados; nunca aceptar texto libre.

`app/actions/analitica.ts` debe declarar `"use server"` y exponer una acción mínima que delegue en `registrarEvento`. Los componentes cliente llaman esta acción en modo best-effort; nunca importan el cliente admin.

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- lib/analitica/eventos.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analitica/eventos.ts lib/analitica/eventos.test.ts
git commit -m "feat: add privacy-safe product analytics"
```

---

## Task 5: Tokens y shell responsive

**Files:**

- Modify: `tailwind.config.ts`
- Create: `components/consumer/ConsumerShell.tsx`
- Create: `components/consumer/DesktopSidebar.tsx`
- Create: `components/consumer/MobileBottomNav.tsx`
- Create: `components/consumer/GlobalSearch.tsx`
- Modify: `lib/viandera/slug.ts`

**Interfaces:**

- Produces:

```ts
export default function ConsumerShell(props: { children: React.ReactNode }): React.ReactNode;
export default function GlobalSearch(props: { initialQuery: string }): React.ReactNode;
```

- [ ] **Step 1: Agregar tokens exactos**

```ts
"ink-muted": "#716255",
line: "#E3D6C7",
"soft-teal": "#EAF4F3",
"soft-coral": "#FCE3D9",
```

Mantener los tokens existentes y usar `coral-600` como `coral-action`; no crear otro hex duplicado.

- [ ] **Step 2: Reservar la ruta**

Agregar `"explorar"` a `RUTAS_RESERVADAS` y una prueba en `slug.test.ts` si se incorpora Vitest a ese helper.

- [ ] **Step 3: Crear navegación semántica**

Desktop: Inicio, Explorar y “Sumar mi cocina”. Mobile: Inicio, Explorar y “Sumar mi cocina”. No mostrar Mapa, Favoritos ni Perfil mientras no existan.

- [ ] **Step 4: Crear búsqueda GET**

El formulario debe enviar `q` a `/explorar`, conservar filtros compatibles y tener label accesible aunque visualmente use placeholder.

- [ ] **Step 5: Verificar responsive**

Comprobar 320, 375, 768, 1024 y 1440 px; sin scroll horizontal; targets de 44 px; foco visible.

- [ ] **Step 6: Validar**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts lib/viandera/slug.ts components/consumer
git commit -m "feat: add responsive consumer shell"
```

---

## Task 6: Consulta pública y `/explorar`

**Files:**

- Create: `lib/viandas/consultas.ts`
- Create: `app/explorar/page.tsx`
- Create: `app/explorar/loading.tsx`
- Create: `app/explorar/error.tsx`
- Create: `components/consumer/FilterChips.tsx`
- Create: `components/consumer/DishCard.tsx`
- Create: `components/consumer/EmptyState.tsx`
- Create: `components/consumer/ResultsSkeleton.tsx`

**Interfaces:**

- Consumes: `FiltrosExplorador`, `parsearFiltros`, `ConsumerShell`, `registrarEvento`.
- Produces:

```ts
export type ResultadoPlato = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  tipo: TipoVianda;
  fotoUrl: string | null;
  etiquetas: string[];
  viandera: {
    nombre: string;
    slug: string;
    barrio: string | null;
    ofreceRetiro: boolean;
    ofreceEnvio: boolean;
  };
};

export async function buscarPlatos(filtros: FiltrosExplorador): Promise<ResultadoPlato[]>;
```

- [ ] **Step 1: Implementar consulta pública acotada**

Consultar únicamente vianderas activas y platos disponibles. Aplicar tipo, etiqueta y modalidad en Supabase cuando sea posible. Limitar a 48 resultados. No consultar service role.

- [ ] **Step 2: Crear la composición de la ruta**

El primer viewport contiene buscador, título y filtros. Debajo se muestran resultados reales; no incluir categorías sin representación en datos.

- [ ] **Step 3: Implementar estados**

- Loading: tarjetas esqueleto con dimensiones finales.
- Empty: mostrar filtros activos y acciones para limpiar.
- Error: preservar URL y usar `reset()`.
- Resultado único: tarjeta destacada, sin grilla visualmente rota.

- [ ] **Step 4: Instrumentar**

Registrar `explore_viewed`, `search_submitted` y `filter_applied` sin bloquear render ni incluir el texto completo de búsqueda en metadata. Como máximo guardar longitud de búsqueda y filtros enumerados.

- [ ] **Step 5: Validar**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Verificar manualmente URLs con combinaciones válidas, inválidas y back-button.

- [ ] **Step 6: Commit**

```bash
git add app/explorar components/consumer lib/viandas/consultas.ts
git commit -m "feat: launch public vianda explorer"
```

---

## Task 7: Rediseñar el perfil público y medir WhatsApp

**Files:**

- Modify: `app/[slug]/page.tsx`
- Create: `components/storefront/StorefrontHeader.tsx`
- Create: `components/storefront/PublicDishCard.tsx`
- Create: `components/storefront/WhatsAppIntent.tsx`
- Create: `components/storefront/StickyContactBar.tsx`

**Interfaces:**

- Consumes: `registrarEvento`, campos nuevos de `Viandera`.
- Produces: recorrido perfil → confirmación → WhatsApp.

- [ ] **Step 1: Extraer presentación sin cambiar la consulta todavía**

Separar cabecera y platos. Mostrar únicamente nombre, bio, barrio, modalidad y fecha de actualización. No mostrar ratings ni sellos.

- [ ] **Step 2: Crear selección de plato**

Cada tarjeta puede marcar un plato para preparar el mensaje. El CTA sigue siendo comprensible sin selección: “Consultar por WhatsApp”.

- [ ] **Step 3: Crear confirmación accesible**

El diálogo debe explicar que disponibilidad, entrega y pago se coordinan directamente. Debe aceptar Escape, devolver el foco y respetar `prefers-reduced-motion`.

- [ ] **Step 4: Preparar el enlace**

Formato:

```ts
const mensaje = plato
  ? `Hola, vi tu perfil en ViandApp. Quería consultar por ${plato.nombre}. ¿Está disponible?`
  : "Hola, vi tu perfil en ViandApp. Quería consultar por tus viandas.";
```

Codificar con `encodeURIComponent`. No incluir precio, dirección ni promesas.

- [ ] **Step 5: Instrumentar la conversión**

Registrar `profile_viewed`, `dish_selected`, `whatsapp_intent` y `whatsapp_clicked`. El último significa clic confirmado en “Continuar a WhatsApp”, no apertura comprobada de la app externa. La salida a WhatsApp debe funcionar aunque falle la analítica.

- [ ] **Step 6: Verificar estados**

- Perfil sin platos.
- Perfil sin teléfono.
- Perfil inactivo.
- Slug inexistente.
- Bio y nombres largos.
- Foto ausente.

- [ ] **Step 7: Validar**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add app/[slug]/page.tsx components/storefront
git commit -m "feat: redesign storefront and track WhatsApp intent"
```

---

## Task 8: Verificación de lanzamiento

**Files:**

- Modify only files that fail verification.
- Modify: `CLAUDE.md` after production prerequisites are confirmed.

**Interfaces:** complete vertical slice.

- [ ] **Step 1: Aplicar la migración en el entorno acordado**

No ejecutar en producción sin confirmación explícita. Registrar fecha y resultado.

- [ ] **Step 2: Completar datos reales mínimos**

Antes de publicar, exigir por viandera: slug, nombre, barrio, teléfono, modalidad y al menos un plato disponible con precio o indicación clara de consulta.

- [ ] **Step 3: Verificación funcional**

Probar:

```text
/explorar
/explorar?q=milanesa
/explorar?tipo=almuerzo
/explorar?modalidad=envio
/explorar?etiqueta=vegetariano
/{slug-real}
```

- [ ] **Step 4: Verificación responsive**

Revisar 320, 375, 768, 1024 y 1440 px; orientación vertical/horizontal; teclado; zoom de texto 200%.

- [ ] **Step 5: Verificación analítica**

Confirmar que los siete eventos llegan, que un fallo de inserción no rompe la UI, que metadata no contiene PII y que los roles públicos no pueden insertar directamente en `eventos_analitica`.

- [ ] **Step 6: Lighthouse y accesibilidad**

Objetivos orientativos: Accessibility ≥95, Best Practices ≥95, Performance ≥85 en mobile. Corregir problemas funcionales; documentar variaciones atribuibles a red o imágenes remotas.

- [ ] **Step 7: Revisión de diff y commit final**

```bash
git status --short
git diff --check
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Si la verificación no exigió cambios, no crear un commit vacío. Si hubo correcciones, revisar `git diff --name-only`, agregar únicamente esos archivos por nombre explícito y crear `fix: complete explorer launch verification`.

---

## Deferred plans

Crear planes separados después de medir uso real:

1. Mapa, geolocalización y sincronización lista↔mapa.
2. Disponibilidad por día, horario y “por encargo”.
3. Favoritos y cuentas de consumidor.
4. Monetización Premium según la definición de producto incluida abajo.
5. Ratings y moderación, solo si existe un mecanismo verificable de compra.

### Definición futura: ViandApp Premium

**No forma parte del MVP actual.** Crear una especificación y un plan de implementación separados únicamente cuando el explorador y la analítica estén estables.

**Condiciones de activación:**

- Al menos 20–30 vianderas activas con catálogo público.
- Un mínimo de 30 días de tráfico medido.
- Eventos confiables de visitas, platos vistos, intención y clic hacia WhatsApp.
- Entrevistas de validación con 10–15 vianderas.
- Evidencia de que algunas recibieron consultas atribuibles a ViandApp.

**Posicionamiento:** suscripción opcional para conseguir más visibilidad, entender el interés de los consumidores y profesionalizar la difusión. Mantener contacto directo y cero comisión por venta en todos los planes.

**Plan gratuito:**

- Perfil público completo.
- Hasta 10 platos publicados.
- Fotos, precios, etiquetas, modalidad y zona aproximada.
- Aparición orgánica en resultados.
- Contacto ilimitado por WhatsApp.
- Enlace y QR para compartir el perfil.

**Premium propuesto:**

- Panel de visitas, platos vistos, intenciones y clics hacia WhatsApp.
- Resumen semanal fácil de interpretar.
- Identificación de platos y filtros que generan mayor interés.
- Catálogo ilimitado y perfil visual ampliado.
- Menú semanal y programación de publicaciones.
- Destacar temporalmente platos elegidos.
- Posiciones patrocinadas claramente identificadas como “Destacado”.
- Generación de placa de menú, historia para redes y QR.
- Mensajes de WhatsApp preparados según el plato consultado.
- Soporte prioritario y acceso anticipado a herramientas comerciales.

**Reglas de confianza:**

- Pagar no otorga una insignia de negocio verificado.
- No vender reseñas, reputación ni datos personales de consumidores.
- No ocultar a las vianderas gratuitas ni degradar artificialmente sus perfiles.
- No prometer ventas garantizadas.
- Separar visualmente resultados patrocinados y orgánicos.

**Hipótesis de precio inicial, expresada en pesos argentinos de septiembre de 2026:**

- Premium Fundadoras: ARS 7.900 por mes durante seis meses para las primeras 20–30 altas.
- Premium regular: ARS 11.900 por mes.
- Trimestral: ARS 31.900.
- Prueba: 30 días o hasta registrar 10 consultas, lo que ocurra primero.

Revisar precios cada 60–90 días usando como referencia aproximadamente 1,5 viandas estándar por mes. Antes de cobrar, volver a relevar precios reales de Rafaela y comprobar disposición a pagar. La comunicación comercial debe ser: “Si ViandApp te genera aproximadamente un pedido nuevo por semana, el plan puede pagarse solo”, presentada como hipótesis y no como garantía.

**Métricas para decidir continuidad:**

- Conversión de prueba a pago.
- Renovación al segundo y tercer mes.
- Ingreso mensual recurrente.
- Promedio de clics hacia WhatsApp por viandera Premium y gratuita.
- Costo de adquirir una viandera paga.
- Tasa de cancelación y motivo declarado.

No construir cobros recurrentes, facturación ni ranking patrocinado hasta aprobar una especificación propia que cubra Mercado Pago, permisos, estados de suscripción, cancelaciones, vencimientos, transparencia del ranking y pruebas.
