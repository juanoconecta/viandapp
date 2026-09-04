# Página pública de la alianza con Puni Rafaela — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL:
> `superpowers:subagent-driven-development` o `superpowers:executing-plans`.

**Revisión correctiva 2026-09-04** sobre el commit `4196de3`: WhatsApp
oficial y fuentes de contenido confirmados por Codex — ruta cerrada
(`/alianza-puni`, ya no una decisión abierta), copy de §4 ahora puede
escribirse con contenido real citado de fuentes oficiales. **Único
bloqueo restante: el archivo de logo de Puni.**

**Objetivo:** bloque en `/` + página propia `/alianza-puni` comunicando la
alianza con Puni, con transparencia explícita sobre qué administra
ViandApp y qué no.

**Arquitectura:** 100% presentacional — un componente Server nuevo en `/`,
una ruta nueva de solo lectura. Sin tablas, sin Server Actions con
efectos secundarios más allá de un link `wa.me`.

**Tech Stack:** Next.js 16 App Router, Server Components.

**Spec:** `docs/superpowers/specs/2026-09-04-alianza-puni-publica-design.md`

## ⚠️ Bloqueo activo — no ejecutar más allá de la Task 0

Este plan **no puede completarse** sin que el usuario provea el logo de
Puni (archivo real — SVG idealmente, o PNG con fondo transparente en
buena resolución — con confirmación de qué versión usar si Puni tiene
más de una). El número de WhatsApp, la ruta, y el contenido descriptivo
ya están resueltos (spec §1). El paso que depende del logo sigue marcado
`TODO(puni-assets)` explícitamente — un ejecutor que llegue ahí sin el
archivo **debe detenerse ahí**, no inventar un placeholder.

## Global Constraints

- No tocar Supabase.
- No inventar el logo ni ningún texto que las fuentes oficiales de la
  spec §1 no respalden.
- El texto de transparencia (spec §4, punto 3) es obligatorio tal cual
  está especificado — no se recorta ni se suaviza sin aprobación
  explícita.
- `/alianza-puni` se suma a `RUTAS_RESERVADAS` (`lib/viandera/slug.ts`).
- El WhatsApp oficial (`+54 9 3548 63-5151`) se usa normalizado
  (`5493548635151`, sin espacios/guiones) en el link `wa.me` — nunca se
  muestra con guiones ni espacios en el `href`, aunque en el texto visible
  de la página sí puede mostrarse formateado para que una persona lo lea
  cómodo.
- `public/aliados/CREDITOS-PUNI.md` documenta fuente, fecha y
  autorización de cada recurso usado (spec §7) — se crea en la misma
  tarea que introduce el primer recurso, no como un paso separado al
  final que alguien podría saltear.
- Mismos criterios de accesibilidad/responsive que el resto del sitio.

---

### Task 0: Confirmar con el usuario — logo pendiente

**Antes de escribir código.**

- [ ] Pedir al usuario el archivo de logo de Puni (formato, y cuál
  versión usar si hay más de una — clara/oscura, con/sin texto).
- [ ] Confirmar el mensaje prellenado exacto para "Consultar servicios"
  — la spec da un ejemplo neutro ("Hola, vi la alianza con ViandApp y
  quería consultar sobre sus servicios de envío"), no un texto cerrado
  a pedido del usuario.
- [ ] Confirmar la posición exacta del bloque en `/` (la spec sugiere
  entre "Descubrí qué hay para hoy" y "Cocinas fundadoras").

**No continuar a la Task 1 sin el logo.**

---

### Task 1: `lib/aliados/puni.ts` + créditos

**Files:**
- Create: `lib/aliados/puni.ts`
- Create: `public/aliados/CREDITOS-PUNI.md`

- [ ] **Paso 1: Constantes** — ya no bloqueadas, el número es conocido:

```ts
// lib/aliados/puni.ts
export const PUNI_WHATSAPP_NUMERO = "5493548635151"; // +54 9 3548 63-5151, sin espacios/guiones
export const PUNI_MENSAJE_PRELLENADO =
  "Hola, vi la alianza con ViandApp y quería consultar sobre sus servicios de envío."; // confirmar texto final en Task 0
export const PUNI_WHATSAPP_HREF = `https://wa.me/${PUNI_WHATSAPP_NUMERO}?text=${encodeURIComponent(PUNI_MENSAJE_PRELLENADO)}`;
```

- [ ] **Paso 2: `CREDITOS-PUNI.md`**

```markdown
# Créditos — alianza con Puni Rafaela

## WhatsApp oficial
+54 9 3548 63-5151 — provisto por Codex en la revisión del 2026-09-04,
confirmado como el WhatsApp oficial publicado por Puni.

## Fuentes de contenido
- https://www.puni.ar/comoFunciona — leída 2026-09-04
- https://www.puni.ar/queEsPuni — leída 2026-09-04

El texto descriptivo de la página `/alianza-puni` está resumido a partir
de estas dos páginas, no citado palabra por palabra salvo donde se marca
entre comillas.

## Logo
[Completar al recibir el archivo: nombre de archivo, fuente exacta,
fecha de obtención.]

## Autorización de uso
ViandApp tiene autorización confirmada para usar el nombre, logo y
material de Puni — confirmado explícitamente por el usuario en la
revisión de Codex del 2026-09-04 sobre el commit `4196de3`.
```

- [ ] **Paso 3: Commit**

```bash
git add lib/aliados/puni.ts public/aliados/CREDITOS-PUNI.md
git commit -m "feat: add confirmed Puni WhatsApp contact and content credits"
```

---

### Task 2: Página `/alianza-puni`

**Files:**
- Create: `app/alianza-puni/page.tsx`
- Modify: `lib/viandera/slug.ts` (sumar `"alianza-puni"` a
  `RUTAS_RESERVADAS`)

- [ ] **Paso 1: `TODO(puni-assets)` — logo de Puni.** Colocar el archivo
  provisto en `public/aliados/puni-logo.<ext>`. Actualizar
  `CREDITOS-PUNI.md` con el nombre de archivo y fecha en el mismo commit.

- [ ] **Paso 2: Texto descriptivo** (spec §4 punto 2) — ya no bloqueado,
  contenido real citado de las fuentes de la Task 1:

```tsx
<div className="flex flex-col gap-3 text-ink/80">
  <p>
    Puni es una plataforma de logística de última milla on-demand: se
    encarga de que el envío de tu pedido llegue de forma profesional,
    sin que el comercio tenga que coordinar un repartidor por su cuenta.
  </p>
  <ul className="flex flex-col gap-1.5">
    <li>Retiro inmediato o envío programado, según lo que necesite el comercio.</li>
    <li>Asignación automática de repartidor por zona.</li>
    <li>Seguimiento del envío para el comercio y el repartidor.</li>
    <li>Sin comisión sobre el producto vendido — Puni cobra por el servicio de envío.</li>
  </ul>
</div>
```

  (JSX ilustrativo del contenido mínimo — la implementación real sigue el
  sistema de diseño existente, tipografía Inter para este bloque de texto
  según `CLAUDE.md`.)

- [ ] **Paso 3: Párrafo de transparencia** — sin cambios respecto a la
  versión anterior de este plan, texto obligatorio de la spec §4 punto 3.

- [ ] **Paso 4: Botón "Consultar servicios"** — usa
  `PUNI_WHATSAPP_HREF` de `lib/aliados/puni.ts` (Task 1), ya no
  bloqueado:

```tsx
<a
  href={PUNI_WHATSAPP_HREF}
  target="_blank"
  rel="noopener noreferrer"
  className="flex min-h-[44px] items-center justify-center rounded-full bg-coral-600 px-6 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
>
  Consultar servicios
</a>
```

- [ ] **Paso 5: Mención de la insignia** — texto simple, sin consultar
  `puni_adhesiones` desde acá.

- [ ] **Paso 6: Verificar responsive** 375–1440px.

- [ ] **Paso 7: Commit** (recién cuando el `TODO(puni-assets)` del logo
  esté resuelto).

```bash
git add app/alianza-puni/page.tsx lib/viandera/slug.ts public/aliados/
git commit -m "feat: add public Puni alliance detail page"
```

---

### Task 3: Bloque en la portada (`/`)

**Files:**
- Create: `components/landing/AlianzaPuni.tsx`
- Modify: `app/(consumer)/page.tsx`

- [ ] **Paso 1: `TODO(puni-assets)` — logo + texto "Alianza estratégica
  con Puni Rafaela"** con `alt` descriptivo del logo.

- [ ] **Paso 2: Botón "Conocé más"** → `/alianza-puni`.

- [ ] **Paso 3: Verificar que la sección no repite la forma visual de la
  sección inmediatamente anterior/siguiente** (regla de `CLAUDE.md`).

- [ ] **Paso 4: Verificar responsive** 375–1440px.

- [ ] **Paso 5: Commit**

```bash
git add components/landing/AlianzaPuni.tsx app/(consumer)/page.tsx
git commit -m "feat: add Puni alliance callout to the homepage"
```

---

## Checklist de seguridad

- [ ] Ningún dato sensible nuevo se introduce.
- [ ] El link de WhatsApp usa `rel="noopener noreferrer"` y
  `target="_blank"`.
- [ ] `encodeURIComponent` en el mensaje prellenado.
- [ ] Ningún texto de la página afirma que ViandApp administra pagos,
  tarifas o disponibilidad de Puni.
- [ ] Ningún texto afirma algo que las fuentes oficiales de la spec §1 no
  respalden.
- [ ] `CREDITOS-PUNI.md` completo (logo incluido) antes del commit final
  de la Task 2.

## QA responsive

- [ ] Bloque en `/`: 375, 768, 1024, 1440px, logo sin distorsión, sin
  salto de layout mientras carga.
- [ ] `/alianza-puni`: mismos breakpoints, botón "Consultar servicios"
  con objetivo táctil ≥44px.

## Punto de detención

**No ejecutar `git push`, merge, ni deploy hasta que Codex revise este
plan — y hasta que el logo de Puni (Task 0) esté disponible.**
