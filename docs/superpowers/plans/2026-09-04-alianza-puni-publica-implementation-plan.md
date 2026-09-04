# Página pública de la alianza con Puni Rafaela — Plan de implementación

> **Para ejecutores agénticos:** REQUIERE SUB-SKILL:
> `superpowers:subagent-driven-development` o `superpowers:executing-plans`.

**Objetivo:** bloque en `/` + página/apartado de detalle comunicando la
alianza con Puni, con transparencia explícita sobre qué administra
ViandApp y qué no.

**Arquitectura:** 100% presentacional — un componente Server nuevo en `/`,
una ruta nueva (o apartado, ver Task 1) de solo lectura. Sin tablas, sin
Server Actions con efectos secundarios más allá de un link `wa.me`.

**Tech Stack:** Next.js 16 App Router, Server Components.

**Spec:** `docs/superpowers/specs/2026-09-04-alianza-puni-publica-design.md`

## ⚠️ Bloqueo activo — no ejecutar más allá de la Task 0

Este plan **no puede completarse** sin que el usuario provea:

1. Logo de Puni (archivo real, con confirmación de derecho de uso).
2. Número de WhatsApp oficial y autorizado de Puni.
3. Cualquier texto/condición que Puni pida usar o evitar.

Cada paso que depende de estos recursos está marcado
`TODO(puni-assets)` explícitamente. Un ejecutor (agente o persona) que
llegue a uno de esos pasos sin los recursos **debe detenerse ahí**, no
inventar un placeholder que después alguien olvide reemplazar.

## Global Constraints

- No tocar Supabase — esta entrega no toca la base de datos en absoluto.
- No inventar logo, número de WhatsApp, ni condiciones comerciales de
  Puni bajo ninguna circunstancia, ni siquiera como placeholder "temporal"
  en código — un placeholder de este tipo tiende a llegar a producción por
  accidente.
- El texto de transparencia (spec §4, punto 3) es obligatorio tal cual está
  especificado en contenido mínimo — no se puede recortar ni suavizar sin
  aprobación explícita.
- Cada ruta raíz nueva se suma a `RUTAS_RESERVADAS`
  (`lib/viandera/slug.ts`) — aplica si se elige ruta propia (Task 1).
- Mismos criterios de accesibilidad/responsive que el resto del sitio
  (WCAG 2.2 AA, 4.5:1, ≥44px táctil, sin scroll horizontal 375–1440px).

---

### Task 0: Confirmar con el usuario — recursos y ubicación

**Antes de escribir código de ningún tipo.**

- [ ] Pedir al usuario los tres recursos listados arriba.
- [ ] Confirmar con el usuario: ¿ruta propia (`/alianza-puni`) o apartado
  con anchor (`/#alianza-puni`)? La spec recomienda ruta propia (§4) pero
  la decisión final es del usuario.
- [ ] Confirmar la posición exacta del bloque en `/` (la spec sugiere
  entre "Descubrí qué hay para hoy" y "Cocinas fundadoras", a confirmar).
- [ ] Confirmar el mensaje prellenado exacto para "Consultar servicios"
  (la spec §4 punto 4 da un ejemplo, no un texto final).

**No continuar a la Task 1 sin esto.**

---

### Task 1: Ruta o apartado de detalle

**Files (si ruta propia — confirmar en Task 0):**
- Create: `app/alianza-puni/page.tsx`
- Modify: `lib/viandera/slug.ts` (sumar `"alianza-puni"` a
  `RUTAS_RESERVADAS`)

**Files (si apartado con anchor — alternativa):**
- Create: `components/landing/AlianzaPuniDetalle.tsx`, montado dentro de
  `app/(consumer)/page.tsx` con `id="alianza-puni"`

- [ ] **Paso 1: `TODO(puni-assets)` — logo de Puni.** Colocar el archivo
  provisto en `public/aliados/puni-logo.<ext>` (formato exacto según lo
  que se reciba) una vez disponible. Hasta entonces, este paso queda sin
  ejecutar.

- [ ] **Paso 2: `TODO(puni-assets)` — texto descriptivo de Puni** (spec §4
  punto 2). Redactar solo con contenido confirmado por el usuario/Puni —
  nunca inferido.

- [ ] **Paso 3: Párrafo de transparencia** (spec §4 punto 3) — este SÍ
  puede escribirse ahora, es contenido de ViandApp, no de Puni:

```tsx
<p className="text-sm text-ink-muted">
  Cada comercio que se suma a ViandApp contrata el servicio de Puni de
  forma directa e independiente. ViandApp no administra esa contratación,
  no interviene en el pago ni en la logística, y no garantiza
  disponibilidad ni tarifas — esa información depende exclusivamente de
  Puni.
</p>
```

- [ ] **Paso 4: `TODO(puni-assets)` — botón "Consultar servicios".**

```tsx
<a
  href={`https://wa.me/${NUMERO_PUNI}?text=${encodeURIComponent(MENSAJE_PUNI)}`}
  target="_blank"
  rel="noopener noreferrer"
  className="flex min-h-[44px] items-center justify-center rounded-full bg-coral-600 px-6 text-sm font-medium text-white transition-colors hover:bg-coral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"
>
  Consultar servicios
</a>
```

`NUMERO_PUNI` y `MENSAJE_PUNI` como constantes en un archivo propio (ej.
`lib/aliados/puni.ts`) — nunca hardcodeadas inline, para que quede un solo
lugar donde cargarlas cuando lleguen (y un solo lugar donde sea obvio que
faltan, si alguien intenta compilar antes de tenerlas: el archivo puede
directamente no existir hasta ese momento, haciendo el bloqueo explícito
a nivel de import).

- [ ] **Paso 5: Mención de la insignia** (spec §4 punto 5) — texto simple,
  sin consultar `puni_adhesiones` desde acá (esa lectura ya vive en
  `/explorar` y `/{slug}`, spec de Envíos/Puni).

- [ ] **Paso 6: Verificar responsive** 375–1440px.

- [ ] **Paso 7: Commit** (recién cuando los `TODO(puni-assets)` estén
  resueltos — un commit con TODOs sin resolver no es "implementado", es
  trabajo a medio terminar; si Codex quiere revisar la estructura antes de
  tener los assets, ese commit debe decir explícitamente en el mensaje que
  está incompleto a la espera de recursos).

```bash
git add app/alianza-puni/ lib/aliados/puni.ts lib/viandera/slug.ts public/aliados/
git commit -m "feat: add public Puni alliance detail page"
```

---

### Task 2: Bloque en la portada (`/`)

**Files:**
- Create: `components/landing/AlianzaPuni.tsx`
- Modify: `app/(consumer)/page.tsx` (montar el componente en la posición
  confirmada en Task 0)

- [ ] **Paso 1: `TODO(puni-assets)` — logo + texto "Alianza estratégica
  con Puni Rafaela"** con `alt` descriptivo del logo (nunca `alt=""` —
  comunica información real, no decorativa).

- [ ] **Paso 2: Botón "Conocé más"** → link a la ruta/anchor de la Task 1.

- [ ] **Paso 3: Verificar que la sección no repite la forma visual de la
  sección inmediatamente anterior/siguiente** (regla de `CLAUDE.md`: no
  repetir el mismo tipo de sección dos veces seguidas).

- [ ] **Paso 4: Verificar responsive** 375–1440px.

- [ ] **Paso 5: Commit**

```bash
git add components/landing/AlianzaPuni.tsx app/(consumer)/page.tsx
git commit -m "feat: add Puni alliance callout to the homepage"
```

---

## Checklist de seguridad

- [ ] Ningún dato sensible nuevo se introduce (página 100% de lectura
  pública, sin formularios propios).
- [ ] El link de WhatsApp usa `rel="noopener noreferrer"` y
  `target="_blank"`.
- [ ] `encodeURIComponent` en el mensaje prellenado (mismo criterio que
  `WhatsAppIntent.tsx`).
- [ ] Ningún texto de la página afirma que ViandApp administra pagos,
  tarifas o disponibilidad de Puni.

## QA responsive

- [ ] Bloque en `/`: 375, 768, 1024, 1440px, logo sin distorsión, sin
  salto de layout mientras carga.
- [ ] Página/apartado de detalle: mismos breakpoints, botón "Consultar
  servicios" con objetivo táctil ≥44px.

## Punto de detención

**No ejecutar `git push`, merge, ni deploy hasta que Codex revise este
plan — y hasta que los recursos de Puni (Task 0) estén confirmados.** Si
Codex revisa la estructura antes de tener los assets, dejarlo explícito en
el reporte: "estructura aprobada, contenido real pendiente de recursos de
Puni".
