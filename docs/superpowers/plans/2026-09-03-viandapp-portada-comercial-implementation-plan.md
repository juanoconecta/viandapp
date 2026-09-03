# Portada comercial de ViandApp — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar in place la landing actual de `/` (`app/(consumer)/page.tsx`)
por la portada comercial consumidor-first descripta en la spec — hero con
mensaje aprobado, buscador y filtros rápidos hacia `/explorar`, carrusel
fotográfico accesible, sección de platos reales, y sección de cocinas
fundadoras que reutiliza el formulario existente sin tocar su Server
Action — sin modificar `/explorar`, `/{slug}`, Supabase, ni conectar la
analítica pausada.

**Architecture:** `app/(consumer)/page.tsx` compone bloques nuevos, todos
Server Components salvo uno, bajo `components/landing/`. El único Client
Component nuevo es `HeroCarousel`; su lógica de reproducción (rotación,
pausa persistente vía botón, pausa temporal por hover/foco/touch,
navegación circular, `prefers-reduced-motion`) vive aislada en un módulo
puro (`lib/carrusel/reproduccion.ts`) sin React ni DOM, testeable con
Vitest en entorno `node` igual que el resto de `lib/`. El componente
visual mantiene un índice lógico (a dónde el temporizador/usuario quiere
ir) separado del índice visible (qué imagen ya terminó de cargar) para
que el crossfade nunca oculte la imagen actual antes de que la siguiente
esté lista, y precarga como máximo una imagen por delante del ciclo — ver
Task 3. La sección "Descubrí qué hay para hoy" reutiliza `buscarPlatos`
(`lib/viandas/consultas.ts`) sin modificarla, a través de un clasificador
puro con dependencia inyectable (`lib/viandas/destacados.ts`, también
testeado con Vitest) que separa resultado/vacío/error del componente
visual, dentro de un límite `<Suspense>` propio para no bloquear el LCP
del hero. `Header.tsx` (compartido por todas las rutas) se extiende con
enlaces nuevos y un `aria-label` propio; `MobileBottomNav.tsx`
(compartido con `/explorar`) solo cambia su `aria-label`. Ningún otro
archivo compartido se toca.

**Tech Stack:** Next.js 16 (App Router, TypeScript, React 19), Tailwind
CSS v4, Vitest (entorno `node`, sin jsdom/RTL — solo se testea lógica
pura en `.test.ts`), `next/image` (exclusivo del carrusel nuevo). Sin
dependencias npm nuevas — el carrusel se construye con React
(`useReducer`, `useEffect`, `useState`, `useRef`) y APIs del navegador ya
disponibles (`matchMedia`, eventos táctiles, `setTimeout`).

**Spec:** [docs/superpowers/specs/2026-09-03-viandapp-portada-comercial-design.md](../specs/2026-09-03-viandapp-portada-comercial-design.md)
(aprobada por el usuario y Codex en el commit `2b155c7`)

## Global Constraints

Extraídas literalmente de la spec — valen para todas las tareas de este
plan:

- **No conectar la analítica pausada.** Ninguna tarea llama a
  `lib/analitica/eventos.ts` ni escribe en `eventos_analitica`.
- **No modificar Supabase.** Ni schema, ni RLS, ni policies, ni datos.
- **No migrar `DishCard` a `next/image`.** Sigue usando `<img>` sin
  cambios; el requisito de `next/image`/`priority`/lazy es exclusivo de
  `HeroCarousel`.
- **No rediseñar `/explorar` ni `/{slug}`.** Ya lanzados, sin cambios.
- **No agregar rutas nuevas.** La portada se rediseña in place en `/`; no
  hace falta tocar `RUTAS_RESERVADAS` en `lib/viandera/slug.ts`.
- **Server Components por defecto.** `HeroCarousel` es el único Client
  Component nuevo. Los demás bloques nuevos no se envuelven en `Reveal`
  salvo que una tarea lo decida explícitamente (ninguna de este plan lo
  hace).
- **No envolver `<form action={anotarseComoInteresada}>`** con
  `AnimatePresence mode="wait"` ni `motion.form` (regla ya vigente en
  `CLAUDE.md`).
- **Mantener `next dev --webpack`** (sin Turbopack) — ninguna tarea toca
  `package.json` ni la configuración de dev server.
- **Imágenes del carrusel: archivos locales únicamente**, bajo
  `public/portada/` — nunca URLs externas.
- **Sin dependencias npm nuevas** para el carrusel — React y APIs del
  navegador ya disponibles alcanzan para todo lo que pide la spec.
- **`next/image` + `priority` en la primera imagen visible del carrusel,
  carga diferida en las restantes** — ver Task 3 para el mecanismo exacto:
  se precarga como máximo **una** imagen por delante del ciclo (nunca las
  cuatro a la vez), y el crossfade espera a que la imagen destino esté
  cargada o haya fallado antes de ocultar la que se está mostrando (nunca
  un intervalo vacío). El `loading="lazy"` nativo no serviría acá: las
  imágenes están apiladas exactamente en el mismo lugar para el
  crossfade, así que el navegador las trata como "en viewport" desde el
  primer render sin importar ese atributo.
- **Header:** el nav completo (Explorar, Cómo funciona, Sumar mi cocina,
  Ingresar/Mi cuenta) se muestra junto recién desde `lg` (1024 px); por
  debajo, solo logo + Ingresar/Mi cuenta.
- **Nombres accesibles únicos:** `<nav>` del header →
  `aria-label="Navegación global"`; `MobileBottomNav` →
  `aria-label="Navegación principal móvil"`; `DesktopSidebar` conserva
  `aria-label="Navegación principal"` sin cambios.
- **Datos reales únicamente.** Ninguna tarea renderiza platos, precios o
  cocinas ficticias como si fueran reales.
- Textos de interfaz en español (es-AR), tono cercano/local.
- Objetivos táctiles de al menos 44 × 44 px en todo elemento clickeable
  nuevo.
- Contraste AA, zoom de texto al 200 %, `prefers-reduced-motion`
  respetado en todo movimiento nuevo.
- Verificación explícita en **320, 375, 640, 768, 1024 y 1440 px**, con y
  sin sesión donde corresponda (el header cambia según sesión).
- **Presupuesto de rendimiento:** Lighthouse Performance ≥ 90 y LCP
  ≤ 2.5 s, medidos en un build de producción (`next build` + `next
  start`), misma máquina/navegador/viewport mobile en la comparación
  antes/después.
- `git diff --check` antes de cada commit; nunca `--no-verify`.

---

## Inspección del código real (antes de dividir tareas)

Resumen de lo que ya existe y cómo condiciona cada tarea — verificado
leyendo el archivo real, no de memoria:

- **`app/(consumer)/page.tsx`** — hoy es la landing 100 % vianderas: hero
  con `href="#sumate"` (relativo, sin `Link`), sección "¿De qué se
  trata?", "¿Cómo funciona?" (3 pasos para vianderas), "Así se va a ver tu
  perfil" (`PreviewPerfil`), "¿Por qué sumarte?" y el formulario en
  `id="sumate"`. Se reemplaza entero por la composición de la Task 9 —
  `PreviewPerfil` y `TarjetasVianda` dejan de usarse en esta página (no se
  borran sus archivos: quedan sin consumidor, fuera del alcance de este
  plan tocarlos).
- **`app/(consumer)/actions.ts`** — exporta `anotarseComoInteresada` y el
  tipo `EstadoFormularioInteres`. No se toca en ninguna tarea.
- **`app/layout.tsx`** — Server Component raíz: `<Header />`,
  `<main>{children}</main>`, `<Footer />` dentro de `<MotionProvider>`,
  con `metadata` global (`title`/`description`/`metadataBase`). Task 9
  agrega un export `metadata` propio en `app/(consumer)/page.tsx` que
  Next.js sobrescribe a nivel de página sin tocar este archivo.
- **`app/globals.css`** — ya trae el fix de padding para
  `body:has([data-consumer-bottom-nav])`, que se activa solo con
  `MobileBottomNav` montado. Como esta portada monta ese componente
  (Task 9), el fix aplica automáticamente. **Sin cambios en ningún
  task de este plan.**
- **`components/layout/Header.tsx`** — Server Component que llama
  `supabase.auth.getUser()` para alternar Ingresar/Mi cuenta. Hoy su
  `<nav>` no tiene `aria-label` y solo muestra "Sumarte como viandera"
  desde `sm`. Task 5 lo modifica in place.
- **`components/layout/Footer.tsx`** — enlace `/#sumate`, sin cambios.
- **`components/consumer/GlobalSearch.tsx`** — `action="/explorar"`,
  `method="GET"`, prop `initialQuery` + `filtrosActuales?`. Se reutiliza
  sin cambios en Task 4 con `initialQuery=""` y sin `filtrosActuales`.
- **`components/consumer/DishCard.tsx`** — usa `<img>` (no `next/image`,
  con el `eslint-disable` correspondiente). Se reutiliza sin cambios en
  Task 7.
- **`components/consumer/ResultsSkeleton.tsx`** — 6 esqueletos fijos
  (`CANTIDAD_ESQUELETOS = 6`). Task 7 decide si reutilizarlo tal cual o
  ajustar el conteo a 8 (ver esa tarea).
- **`components/consumer/MobileBottomNav.tsx`** — `aria-label="Navegación
  principal"` hoy, ítems Inicio/Explorar/Sumar mi cocina, `lg:hidden`.
  Task 5 cambia únicamente el `aria-label`.
- **`components/consumer/DesktopSidebar.tsx`** — `aria-label="Navegación
  principal"`, exclusivo de `/explorar` (usado desde `ConsumerShell`).
  **No se toca en ningún task.**
- **`components/landing/FormularioInteres.tsx`** — ya es Client Component
  (`"use client"`, `useActionState(anotarseComoInteresada, ...)`).
  Task 8 lo envuelve sin tocar su código.
- **`components/landing/MotionProvider.tsx`** — Client Component,
  `MotionConfig reducedMotion="user"` alrededor de toda la app. Ya activo
  hoy vía `app/layout.tsx`; ninguna tarea lo modifica.
- **`components/landing/Reveal.tsx`** — Client Component de animación de
  entrada (`motion.div` con `whileInView`). Disponible pero **no se usa
  en ninguna tarea de este plan** (Global Constraints).
- **`components/landing/icons.tsx`** — `IconPlato`, `IconMoneda`,
  `IconPin`, `IconControles`, `IconChispa`, `IconCheck`, todos SVG de
  línea (`stroke="currentColor"`, `strokeWidth={1.75}`) vía un helper
  `base()`. Task 3 agrega 4 íconos nuevos siguiendo el mismo patrón.
- **`lib/viandas/consultas.ts`** — exporta `buscarPlatos(filtros:
  FiltrosExplorador): Promise<ResultadoPlato[]>`, ordena por `created_at`
  descendente, límite 48, lanza `Error` sanitizado ante un fallo real de
  Supabase. Task 7 la llama tal cual, sin modificarla.
- **`lib/viandas/filtros.ts`** — exporta `FiltrosExplorador` y
  `parsearFiltros`. Task 4 arma querystrings hacia `/explorar` con los
  mismos nombres de parámetro (`tipo`, `modalidad`) sin importar ni
  modificar este archivo.
- **`tailwind.config.ts`** — tokens `coral`/`teal`/`mostaza`/`paper`/
  `card`/`ink`/`ink-muted`/`line`/`soft-teal`/`soft-coral`, fuentes
  `font-display`/`font-sans`. Ninguna tarea le agrega tokens.
- **`next.config.ts`** — hoy vacío (`{}`, sin `images.remotePatterns` ni
  ninguna otra opción). Como el carrusel sirve imágenes locales desde
  `public/portada/`, `next/image` funciona con la configuración por
  defecto — **ninguna tarea necesita tocar este archivo.**
- **`CLAUDE.md`** — documenta cada entrega mayor en "Estado del
  proyecto". Task 9 agrega un párrafo nuevo ahí, siguiendo el mismo
  formato que las entradas existentes (pivot a landing, panel de
  viandera, vidriera pública, explorador).

---

## Task 1: Preparación y validación de las imágenes del carrusel

**Files:**
- Create: `public/portada/carrusel-01.webp`
- Create: `public/portada/carrusel-02.webp`
- Create: `public/portada/carrusel-03.webp`
- Create: `public/portada/carrusel-04.webp`
- Create: `public/portada/CREDITOS.md`
- Create: `components/landing/carruselDatos.ts`

**Interfaces:**
- Consumes: nada (primera tarea del plan).
- Produces: `FOTOS_CARRUSEL: FotoCarrusel[]` (4 elementos) y los 4
  archivos de imagen que Task 3 (`HeroCarousel`) importa por ruta
  (`/portada/carrusel-0N.webp`). **Todas las tareas de Task 3 en
  adelante que dependen de imágenes reales quedan bloqueadas hasta que
  esta tarea esté completa y verificada** — ver "Precondición
  verificable" abajo.

Esta tarea no toca código de la aplicación (solo assets + un módulo de
datos), así que no aplican pasos de test/lint/tsc — la verificación es un
checklist con criterio de aprobación/bloqueo explícito.

**Decisión de recorte (fija esta tarea, no queda abierta):** cada foto se
guarda como **un único archivo** por posición del carrusel (no un archivo
separado para el crop desktop y otro para mobile). El encuadre se resuelve
en tiempo de render con `next/image` `fill` + `object-fit: cover` dentro
de un contenedor cuyo `aspect-ratio` cambia por breakpoint (`aspect-[3/4]`
en mobile, `aspect-[16/11]` desde `lg` — ver Task 3). Esto es posible
porque la spec ya exige que el foco principal de cada foto esté centrado
con margen suficiente en ambos ejes (sección 8 de la spec) precisamente
para que un mismo archivo funcione recortado a ambas relaciones de
aspecto sin recomponer la imagen a mano. La tabla de medidas de la spec
(2400×1600 maestro, 1600×1100 desktop, 900×1200 mobile) define el
**encuadre de composición** al fotografiar/exportar, no cuatro archivos
por foto.

- [ ] **Paso 1: Conseguir o encargar las 4 fotografías fuente**

  Dos caminos válidos (elegir uno, documentarlo en `CREDITOS.md`):

  - **(a) Fotos propias de ViandApp** — tomadas para el proyecto (comida
    real, aunque no corresponda todavía a un plato publicado en la base).
    No necesitan licencia de terceros; se documentan como "Foto propia de
    ViandApp, tomada [fecha]".
  - **(b) Stock con licencia de uso comercial** — de un banco que permita
    uso comercial sin atribución obligatoria (ej. licencia tipo Unsplash
    License, Pexels License, o equivalente que cubra explícitamente uso
    comercial sin límite de tiempo). Se documenta URL de origen, nombre
    del banco, tipo de licencia y fecha de descarga.

  Cada una de las 4 debe mostrar comida casera de tipo vianda (plato
  servido, idealmente en un recipiente tipo tupper/vianda) con el sujeto
  centrado y espacio libre alrededor (arriba/abajo y a los lados) para
  que el recorte 3:4 y el recorte ~16:11 funcionen sin cortar el plato.

- [ ] **Paso 2: Exportar cada foto al tamaño maestro y optimizar**

  Redimensionar/recortar cada fuente a **2400 × 1600 px (3:2)** con el
  sujeto centrado, exportar a WebP (o AVIF) con compresión que mantenga
  el peso final por debajo de los objetivos de la sección 8 de la spec.
  Como `next/image` va a servir tamaños más chicos en runtime, el
  archivo en `public/` puede pesar más que el objetivo final de pantalla
  siempre que no sea excesivo — objetivo práctico para el archivo fuente
  en `public/portada/`: **≤ 400 KB por archivo** (deja margen para que
  `next/image` optimice más todavía al servir tamaños menores en mobile).

- [ ] **Paso 3: Guardar los 4 archivos con nombre definitivo**

  `public/portada/carrusel-01.webp`, `carrusel-02.webp`,
  `carrusel-03.webp`, `carrusel-04.webp` — en ese orden, que es el orden
  de rotación por defecto del carrusel.

- [ ] **Paso 4: Documentar origen y licencia en `CREDITOS.md`**

  Crear `public/portada/CREDITOS.md` con este encabezado y esta tabla
  **vacía** (sin filas de ejemplo con corchetes — los corchetes no son
  contenido válido en ningún archivo de esta tarea, ver el script de
  verificación del Paso 6):

  ```markdown
  # Créditos de imágenes — carrusel de la portada

  Todas las fotografías son ilustrativas (no corresponden todavía a
  platos publicados por una viandera activa) — el carrusel las marca
  como "Imagen ilustrativa" según la sección 5 de la spec de portada
  comercial.

  | Archivo | Origen | Licencia | Fecha |
  |---|---|---|---|
  ```

  Completar una fila por cada uno de los 4 archivos, con estos valores
  reales (esquema de la columna, no texto a copiar):

  - **Archivo:** el nombre exacto (`carrusel-01.webp`, etc.).
  - **Origen:** `Foto propia de ViandApp` si es una foto tomada para el
    proyecto, o el nombre real del banco de fotos usado (ej. `Unsplash`,
    `Pexels`) si es de stock.
  - **Licencia:** si es foto propia, `Foto propia, sin restricción de
    terceros`; si es de stock, el nombre real y completo de la licencia
    bajo la que se descargó (ej. `Unsplash License`, `Pexels License`).
  - **Fecha:** la fecha real en que se obtuvo/exportó el archivo, en
    formato ISO `AAAA-MM-DD` con los dígitos reales (ej. `2026-09-10`) —
    `AAAA-MM-DD` es la especificación del formato, nunca un valor a
    copiar tal cual.

  Ninguna celda queda vacía ni con corchetes.

- [ ] **Paso 5: Crear `components/landing/carruselDatos.ts`**

  ```ts
  export type FotoCarrusel = {
    src: string;
    alt: string;
    esIlustrativa: boolean;
    vianderaSlug?: string;
  };

  // Las 4 fotos son ilustrativas: no corresponden a un plato publicado
  // hoy por una viandera activa (ver public/portada/CREDITOS.md para
  // origen y licencia). Cuando exista un plato real con foto de calidad
  // suficiente, la entrada correspondiente puede pasar a
  // `esIlustrativa: false` y sumar `vianderaSlug` — decisión posterior,
  // fuera de este plan (ver "Fuera de alcance" de la spec).
  export const FOTOS_CARRUSEL: FotoCarrusel[] = [
    {
      src: "/portada/carrusel-01.webp",
      alt: "", // completar: descripción real y específica de esta foto puntual
      esIlustrativa: true,
    },
    {
      src: "/portada/carrusel-02.webp",
      alt: "", // completar: descripción real y específica de esta foto puntual
      esIlustrativa: true,
    },
    {
      src: "/portada/carrusel-03.webp",
      alt: "", // completar: descripción real y específica de esta foto puntual
      esIlustrativa: true,
    },
    {
      src: "/portada/carrusel-04.webp",
      alt: "", // completar: descripción real y específica de esta foto puntual
      esIlustrativa: true,
    },
  ];
  ```

  Cada `alt: ""` se reemplaza por una oración real, específica de esa
  foto puntual, de al menos 8 palabras describiendo lo que se ve (ej.
  "Milanesa napolitana con puré de papas servida en un contenedor de
  vianda") — nunca genérica ("foto de comida"), nunca vacía, nunca
  repetida entre las 4 fotos, y nunca copiada de este plan como si fuera
  el valor final (el comentario `// completar: ...` se borra junto con
  el `""` que reemplaza).

- [ ] **Paso 6: Verificar automáticamente que no queden placeholders**

  Correr este script antes de commitear — cada verificación imprime
  `FALLA: ...` y corta con código de salida distinto de cero si algo
  quedó sin completar:

  ```bash
  set -e

  if grep -n '\[.*\]' public/portada/CREDITOS.md components/landing/carruselDatos.ts; then
    echo "FALLA: quedan corchetes de placeholder sin completar"; exit 1
  fi

  if grep -n 'AAAA-MM-DD' public/portada/CREDITOS.md; then
    echo "FALLA: falta reemplazar AAAA-MM-DD por una fecha real en al menos una fila"; exit 1
  fi

  if grep -n 'alt: ""' components/landing/carruselDatos.ts; then
    echo "FALLA: queda al menos un alt vacío sin completar"; exit 1
  fi

  CANTIDAD_ALT_UNICOS=$(grep -o 'alt: "[^"]*"' components/landing/carruselDatos.ts | sort -u | wc -l)
  if [ "$CANTIDAD_ALT_UNICOS" -lt 4 ]; then
    echo "FALLA: hay menos de 4 alt distintos (algunos repetidos)"; exit 1
  fi

  echo "OK: sin placeholders, 4 alt distintos, sin AAAA-MM-DD literal"
  ```

  Esperado: `OK: sin placeholders, 4 alt distintos, sin AAAA-MM-DD
  literal` — cualquier otra salida bloquea el commit de este paso hasta
  corregir el archivo señalado.

**Precondición verificable — criterio de bloqueo:**

Esta tarea se considera completa, y solo entonces puede arrancar Task 3,
cuando las 6 condiciones siguientes son todas verdaderas:

1. Existen exactamente los 4 archivos en `public/portada/` con esos
   nombres exactos.
2. Cada archivo pesa ≤ 400 KB (`ls -la public/portada/*.webp` o
   equivalente).
3. Cada archivo es WebP o AVIF real (no un JPEG/PNG renombrado —
   confirmar con `file public/portada/carrusel-01.webp` o el inspector de
   formato del sistema operativo).
4. `public/portada/CREDITOS.md` existe con las 4 filas completas (origen,
   licencia y fecha reales) — confirmado por el script del Paso 6.
5. `components/landing/carruselDatos.ts` existe, exporta `FOTOS_CARRUSEL`
   con exactamente 4 entradas y 4 `alt` distintos y completos — confirmado
   por el mismo script.
6. Visualmente, con cada imagen cargada en un visor a 375 px de ancho
   recortada a 3:4 y a 1440 px de ancho recortada a ~16:11, el sujeto
   principal de la foto no queda cortado en ninguno de los dos recortes
   (verificación manual, sin herramienta automática — el script del Paso
   6 no cubre este punto porque es un juicio visual, no un patrón de
   texto).

- [ ] **Paso 7: Confirmar el checklist de arriba y hacer commit**

```bash
git add public/portada/ components/landing/carruselDatos.ts
git status
```

Revisar que `git status` no muestre ningún otro archivo modificado antes
de confirmar.

```bash
git diff --check
```

Esperado: sin salida (sin errores de espacios en blanco).

```bash
git commit -m "feat: add hero carousel source images and data module"
```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 2. Codex revisa especialmente `CREDITOS.md` (licencia real, no
placeholder) y los `alt` de `carruselDatos.ts`.

---

## Task 2: Modelo de datos y lógica pura de reproducción del carrusel

**Files:**
- Create: `lib/carrusel/reproduccion.ts`
- Create: `lib/carrusel/reproduccion.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro, sin dependencias de proyecto).
- Produces: `EstadoCarrusel`, `AccionCarrusel`, `estadoInicial`,
  `siguienteIndice`, `indiceAnterior`, `reducirCarrusel`,
  `rotacionActiva`, `DURACION_ROTACION_MS`, `DURACION_CROSSFADE_MS` — Task
  3 (`HeroCarousel`) importa todo esto de `@/lib/carrusel/reproduccion`
  para manejar el `useReducer` del componente visual, sin reimplementar
  ninguna regla de reproducción en JSX.

Este módulo no importa React ni toca el DOM — es la razón por la que se
puede testear con Vitest en el mismo entorno `node` que ya usan
`lib/viandas/filtros.test.ts` y el resto de `lib/` (ver
`vitest.config.mts`, `include: ["**/*.test.ts"]`).

- [ ] **Paso 1: Escribir el test que falla — navegación circular**

  Crear `lib/carrusel/reproduccion.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import {
    DURACION_CROSSFADE_MS,
    DURACION_ROTACION_MS,
    estadoInicial,
    indiceAnterior,
    reducirCarrusel,
    rotacionActiva,
    siguienteIndice,
  } from "./reproduccion";

  describe("siguienteIndice", () => {
    it("avanza al siguiente índice", () => {
      expect(siguienteIndice(0, 4)).toBe(1);
      expect(siguienteIndice(2, 4)).toBe(3);
    });

    it("da la vuelta circularmente desde el último", () => {
      expect(siguienteIndice(3, 4)).toBe(0);
    });
  });

  describe("indiceAnterior", () => {
    it("retrocede al índice anterior", () => {
      expect(indiceAnterior(2, 4)).toBe(1);
    });

    it("da la vuelta circularmente desde el primero", () => {
      expect(indiceAnterior(0, 4)).toBe(3);
    });
  });
  ```

- [ ] **Paso 2: Correr el test y confirmar que falla**

  ```bash
  npx vitest run lib/carrusel/reproduccion.test.ts
  ```

  Esperado: falla con un error de módulo no encontrado (`Cannot find
  module './reproduccion'` o equivalente) — `lib/carrusel/reproduccion.ts`
  todavía no existe.

- [ ] **Paso 3: Implementar la navegación circular**

  Crear `lib/carrusel/reproduccion.ts`:

  ```ts
  export const DURACION_ROTACION_MS = 6000;
  export const DURACION_CROSSFADE_MS = 500;

  export function siguienteIndice(indice: number, total: number): number {
    if (total <= 0) return 0;
    return (indice + 1) % total;
  }

  export function indiceAnterior(indice: number, total: number): number {
    if (total <= 0) return 0;
    return (indice - 1 + total) % total;
  }
  ```

- [ ] **Paso 4: Correr el test y confirmar que pasa**

  ```bash
  npx vitest run lib/carrusel/reproduccion.test.ts
  ```

  Esperado: los 4 tests de navegación circular en verde.

- [ ] **Paso 5: Escribir los tests que fallan — estado, reducer y pausa
      persistente**

  Agregar a `lib/carrusel/reproduccion.test.ts` (mismo archivo,
  agregando imports y bloques `describe` nuevos):

  ```ts
  import {
    type AccionCarrusel,
    type EstadoCarrusel,
    reducirCarrusel,
    rotacionActiva,
  } from "./reproduccion";
  ```

  (fusionar con el import existente del Paso 1 en un único `import` de
  `"./reproduccion"`)

  ```ts
  describe("estadoInicial", () => {
    it("arranca en el índice 0 sin pausa temporal", () => {
      expect(estadoInicial(4, true)).toEqual({
        indice: 0,
        reproduciendo: true,
        pausadoTemporalmente: false,
      });
    });

    it("respeta el autoplay inicial en false (prefers-reduced-motion)", () => {
      expect(estadoInicial(4, false).reproduciendo).toBe(false);
    });
  });

  describe("rotacionActiva", () => {
    it("es true solo cuando reproduciendo y no hay pausa temporal", () => {
      expect(
        rotacionActiva({ indice: 0, reproduciendo: true, pausadoTemporalmente: false }),
      ).toBe(true);
    });

    it("es false si no está reproduciendo", () => {
      expect(
        rotacionActiva({ indice: 0, reproduciendo: false, pausadoTemporalmente: false }),
      ).toBe(false);
    });

    it("es false durante una pausa temporal, aunque reproduciendo sea true", () => {
      expect(
        rotacionActiva({ indice: 0, reproduciendo: true, pausadoTemporalmente: true }),
      ).toBe(false);
    });
  });

  describe("reducirCarrusel — TICK", () => {
    const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };

    it("avanza el índice cuando la rotación está activa", () => {
      const siguiente = reducirCarrusel(base, { tipo: "TICK" }, 4);
      expect(siguiente.indice).toBe(1);
    });

    it("no avanza si reproduciendo es false", () => {
      const pausado: EstadoCarrusel = { ...base, reproduciendo: false };
      expect(reducirCarrusel(pausado, { tipo: "TICK" }, 4)).toEqual(pausado);
    });

    it("no avanza durante una pausa temporal", () => {
      const enHover: EstadoCarrusel = { ...base, pausadoTemporalmente: true };
      expect(reducirCarrusel(enHover, { tipo: "TICK" }, 4)).toEqual(enHover);
    });
  });

  describe("reducirCarrusel — navegación manual", () => {
    const base: EstadoCarrusel = { indice: 0, reproduciendo: false, pausadoTemporalmente: false };

    it("SIGUIENTE avanza el índice aunque no esté reproduciendo", () => {
      expect(reducirCarrusel(base, { tipo: "SIGUIENTE" }, 4).indice).toBe(1);
    });

    it("ANTERIOR desde el índice 0 da la vuelta al último", () => {
      expect(reducirCarrusel(base, { tipo: "ANTERIOR" }, 4).indice).toBe(3);
    });

    it("IR_A cambia al índice pedido", () => {
      expect(reducirCarrusel(base, { tipo: "IR_A", indice: 2 }, 4).indice).toBe(2);
    });

    it("IR_A con índice fuera de rango no cambia el estado", () => {
      expect(reducirCarrusel(base, { tipo: "IR_A", indice: 9 }, 4)).toEqual(base);
      expect(reducirCarrusel(base, { tipo: "IR_A", indice: -1 }, 4)).toEqual(base);
    });
  });

  describe("reducirCarrusel — botón de reproducción persistente (WCAG 2.2.2)", () => {
    it("ALTERNAR_REPRODUCCION invierte reproduciendo sin tocar la pausa temporal", () => {
      const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
      expect(reducirCarrusel(base, { tipo: "ALTERNAR_REPRODUCCION" }, 4)).toEqual({
        ...base,
        reproduciendo: false,
      });
    });

    it("una pausa explícita persiste a través de hover/foco (no se revierte sola)", () => {
      const reproduciendo: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
      const pausadoPorBoton = reducirCarrusel(reproduciendo, { tipo: "ALTERNAR_REPRODUCCION" }, 4);
      const conHover = reducirCarrusel(pausadoPorBoton, { tipo: "INTERACCION_INICIO" }, 4);
      const sinHover = reducirCarrusel(conHover, { tipo: "INTERACCION_FIN" }, 4);
      expect(sinHover.reproduciendo).toBe(false);
      expect(rotacionActiva(sinHover)).toBe(false);
    });

    it("la rotación se reanuda al perder hover/foco si seguía reproduciendo", () => {
      const reproduciendo: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
      const conHover = reducirCarrusel(reproduciendo, { tipo: "INTERACCION_INICIO" }, 4);
      expect(rotacionActiva(conHover)).toBe(false);
      const sinHover = reducirCarrusel(conHover, { tipo: "INTERACCION_FIN" }, 4);
      expect(rotacionActiva(sinHover)).toBe(true);
    });

    it("INTERACCION_INICIO y FIN no tocan reproduciendo", () => {
      const base: EstadoCarrusel = { indice: 0, reproduciendo: false, pausadoTemporalmente: false };
      const conHover = reducirCarrusel(base, { tipo: "INTERACCION_INICIO" }, 4);
      expect(conHover.reproduciendo).toBe(false);
      expect(conHover.pausadoTemporalmente).toBe(true);
    });
  });

  describe("reducirCarrusel — secuencia de interacción táctil", () => {
    it("un swipe completo (INTERACCION_INICIO → SIGUIENTE → INTERACCION_FIN) navega sin alterar el estado persistente", () => {
      const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
      const alTocar = reducirCarrusel(base, { tipo: "INTERACCION_INICIO" }, 4);
      const trasSwipe = reducirCarrusel(alTocar, { tipo: "SIGUIENTE" }, 4);
      const alSoltar = reducirCarrusel(trasSwipe, { tipo: "INTERACCION_FIN" }, 4);
      expect(alSoltar).toEqual({ indice: 1, reproduciendo: true, pausadoTemporalmente: false });
    });

    it("un touchcancel (sin swipe) solo termina la pausa temporal, sin navegar ni tocar el estado persistente", () => {
      const base: EstadoCarrusel = { indice: 2, reproduciendo: false, pausadoTemporalmente: false };
      const alTocar = reducirCarrusel(base, { tipo: "INTERACCION_INICIO" }, 4);
      const alCancelar = reducirCarrusel(alTocar, { tipo: "INTERACCION_FIN" }, 4);
      expect(alCancelar).toEqual(base);
    });
  });

  describe("reducirCarrusel — acción desconocida", () => {
    it("devuelve el mismo estado sin romper", () => {
      const base: EstadoCarrusel = { indice: 0, reproduciendo: true, pausadoTemporalmente: false };
      // @ts-expect-error — acción inválida a propósito, para probar el default del switch
      expect(reducirCarrusel(base, { tipo: "NO_EXISTE" }, 4)).toEqual(base);
    });
  });
  ```

- [ ] **Paso 6: Correr los tests y confirmar que fallan**

  ```bash
  npx vitest run lib/carrusel/reproduccion.test.ts
  ```

  Esperado: falla en tiempo de compilación de TypeScript / import — los
  símbolos `estadoInicial`, `EstadoCarrusel`, `AccionCarrusel`,
  `reducirCarrusel` todavía no existen en `reproduccion.ts`.

- [ ] **Paso 7: Implementar el estado, el reducer y `rotacionActiva`**

  Agregar a `lib/carrusel/reproduccion.ts` (después de lo escrito en el
  Paso 3):

  ```ts
  export type EstadoCarrusel = {
    indice: number;
    /** Estado explícito y persistente, controlado por el botón de
     * reproducción — la única fuente de verdad sobre si el carrusel
     * rota (spec, sección 5). */
    reproduciendo: boolean;
    /** Pausa transitoria por hover/foco — nunca modifica `reproduciendo`. */
    pausadoTemporalmente: boolean;
  };

  export type AccionCarrusel =
    | { tipo: "TICK" }
    | { tipo: "SIGUIENTE" }
    | { tipo: "ANTERIOR" }
    | { tipo: "IR_A"; indice: number }
    | { tipo: "ALTERNAR_REPRODUCCION" }
    | { tipo: "INTERACCION_INICIO" }
    | { tipo: "INTERACCION_FIN" };

  export function estadoInicial(
    totalImagenes: number,
    autoplayInicial: boolean,
  ): EstadoCarrusel {
    return { indice: 0, reproduciendo: autoplayInicial, pausadoTemporalmente: false };
  }

  export function rotacionActiva(estado: EstadoCarrusel): boolean {
    return estado.reproduciendo && !estado.pausadoTemporalmente;
  }

  export function reducirCarrusel(
    estado: EstadoCarrusel,
    accion: AccionCarrusel,
    totalImagenes: number,
  ): EstadoCarrusel {
    switch (accion.tipo) {
      case "TICK": {
        if (!rotacionActiva(estado)) return estado;
        return { ...estado, indice: siguienteIndice(estado.indice, totalImagenes) };
      }
      case "SIGUIENTE":
        return { ...estado, indice: siguienteIndice(estado.indice, totalImagenes) };
      case "ANTERIOR":
        return { ...estado, indice: indiceAnterior(estado.indice, totalImagenes) };
      case "IR_A": {
        if (accion.indice < 0 || accion.indice >= totalImagenes) return estado;
        return { ...estado, indice: accion.indice };
      }
      case "ALTERNAR_REPRODUCCION":
        return { ...estado, reproduciendo: !estado.reproduciendo };
      case "INTERACCION_INICIO":
        return { ...estado, pausadoTemporalmente: true };
      case "INTERACCION_FIN":
        return { ...estado, pausadoTemporalmente: false };
      default:
        return estado;
    }
  }
  ```

- [ ] **Paso 8: Correr los tests y confirmar que todos pasan**

  ```bash
  npx vitest run lib/carrusel/reproduccion.test.ts
  ```

  Esperado: todos los tests (navegación circular + estado inicial +
  `rotacionActiva` + reducer completo) en verde, cero fallos.

- [ ] **Paso 9: Verificar el resto de la suite, lint, tipos y espacios**

  ```bash
  npm test
  ```

  Esperado: toda la suite existente sigue en verde (este módulo no toca
  nada fuera de `lib/carrusel/`).

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos.

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 10: Commit**

  ```bash
  git add lib/carrusel/reproduccion.ts lib/carrusel/reproduccion.test.ts
  git commit -m "test: add pure carousel playback state machine"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 3. Este módulo es la pieza central de cumplimiento de WCAG 2.2.2 —
Codex revisa especialmente que `INTERACCION_INICIO`/`FIN` nunca toquen
`reproduciendo` (incluida la secuencia compuesta de touch: inicio →
navegación → fin) y que `TICK` sea un no-op fuera de `rotacionActiva`.

---

## Task 3: `HeroCarousel` — componente visual accesible

**Files:**
- Modify: `components/landing/icons.tsx`
- Create: `components/landing/HeroCarousel.tsx`

**Interfaces:**
- Consumes: `FOTOS_CARRUSEL`/`FotoCarrusel` de
  `@/components/landing/carruselDatos` (Task 1); `estadoInicial`,
  `reducirCarrusel`, `rotacionActiva`, `siguienteIndice`,
  `DURACION_ROTACION_MS`, `DURACION_CROSSFADE_MS`, `EstadoCarrusel`,
  `AccionCarrusel` de `@/lib/carrusel/reproduccion` (Task 2).
- Produces: `export default function HeroCarousel(props: {
  fotos: FotoCarrusel[] }): JSX.Element` — Task 4 (`PortadaHero`) lo
  importa y renderiza pasándole `FOTOS_CARRUSEL`.

Este componente es Client Component (`"use client"`) — el único que
agrega esta portada. No tiene lógica propia de reproducción (esa vive en
Task 2, ya testeada, incluida la secuencia exacta de pausa/navegación
táctil — ver ahí "reducirCarrusel — secuencia de interacción táctil");
acá solo conecta esa lógica pura al DOM (temporizador, teclado, touch,
carga/precarga de `next/image`, fallback) y no se prueba con Vitest
porque este repo no tiene entorno de test de componentes (sin jsdom/RTL —
mismo criterio que ya aplica a `DishCard`, `FilterChips` o
`GlobalSearch`, ninguno tiene test dedicado). Lo que sí es exclusivamente
de este componente y por eso solo se verifica en QA manual (Task 11) es
el cableado real de eventos del DOM: el umbral de píxeles del swipe, el
tiempo real de carga de una imagen en una conexión lenta, y que el
`fetchpriority` que genera `next/image` efectivamente llegue así al
navegador. Se verifica con `tsc`/`lint`/`build` y con QA manual en el
navegador (Task 11).

- [ ] **Paso 1: Agregar los 4 íconos nuevos a `components/landing/icons.tsx`**

  Mismo patrón que los íconos existentes (helper `base()`, `stroke`
  `currentColor`, `strokeWidth={1.75}`, puntas redondeadas) — agregar al
  final del archivo:

  ```tsx
  export function IconFlechaIzquierda({ className }: { className?: string }) {
    return base(<path d="M15 5l-7 7 7 7" />, className);
  }

  export function IconFlechaDerecha({ className }: { className?: string }) {
    return base(<path d="M9 5l7 7-7 7" />, className);
  }

  export function IconPausa({ className }: { className?: string }) {
    return base(
      <>
        <path d="M8 5v14" />
        <path d="M16 5v14" />
      </>,
      className,
    );
  }

  export function IconReproducir({ className }: { className?: string }) {
    return base(<path d="M7 4.5v15l13-7.5-13-7.5Z" strokeLinejoin="round" />, className);
  }
  ```

- [ ] **Paso 2: Crear `components/landing/HeroCarousel.tsx`**

  ```tsx
  "use client";

  import { useEffect, useReducer, useRef, useState } from "react";
  import Image from "next/image";
  import type { FotoCarrusel } from "./carruselDatos";
  import {
    DURACION_CROSSFADE_MS,
    DURACION_ROTACION_MS,
    estadoInicial,
    reducirCarrusel,
    rotacionActiva,
    siguienteIndice,
  } from "@/lib/carrusel/reproduccion";
  import {
    IconFlechaDerecha,
    IconFlechaIzquierda,
    IconPausa,
    IconPlato,
    IconReproducir,
  } from "./icons";

  const UMBRAL_SWIPE_PX = 40;

  export default function HeroCarousel({ fotos }: { fotos: FotoCarrusel[] }) {
    const [estado, dispatch] = useReducer(
      (s: ReturnType<typeof estadoInicial>, a: Parameters<typeof reducirCarrusel>[1]) =>
        reducirCarrusel(s, a, fotos.length),
      undefined,
      () => estadoInicial(fotos.length, false),
    );

    // `montadas`: qué imágenes tienen un <Image> en el DOM (participan
    // de la precarga). `cargadas`/`fallidas`: qué imágenes ya
    // terminaron de resolver, con éxito o con error. El crossfade
    // visual espera a que el destino esté en uno de esos dos últimos
    // sets antes de mostrarlo — ver `indiceVisible` más abajo.
    const [montadas, setMontadas] = useState<Set<number>>(
      () => new Set([0, siguienteIndice(0, fotos.length)]),
    );
    const [cargadas, setCargadas] = useState<Set<number>>(() => new Set());
    const [fallidas, setFallidas] = useState<Set<number>>(() => new Set());
    // Índice que realmente se muestra (opacidad 1) — deliberadamente
    // distinto de `estado.indice`. `estado.indice` es "a dónde el
    // temporizador o el usuario quiere ir"; `indiceVisible` es "qué
    // imagen ya está lista para mostrarse". La transición visual ocurre
    // recién cuando ambos coinciden, así que la imagen anterior nunca
    // se oculta antes de que la siguiente termine de cargar (o falle).
    const [indiceVisible, setIndiceVisible] = useState(0);
    const touchStartX = useRef<number | null>(null);

    // Detección de prefers-reduced-motion solo al montar, en el
    // cliente — nunca durante el render de servidor (evita
    // desajustes de hidratación). El estado arranca siempre en
    // `reproduciendo: false`; si el usuario NO prefiere movimiento
    // reducido, esto lo activa una única vez. Si el usuario ya lo
    // pausó explícitamente antes de que este efecto corra, no puede
    // pasar — este efecto corre una sola vez, antes de cualquier
    // interacción posible.
    useEffect(() => {
      const prefiereReducido = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!prefiereReducido) {
        dispatch({ tipo: "ALTERNAR_REPRODUCCION" });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Precarga como máximo una imagen por delante del ciclo — nunca las
    // cuatro. El estado inicial ya cubre 0 (visible) + 1 (siguiente);
    // cada vez que `estado.indice` cambia, agrega la siguiente de ESA
    // posición, así siempre hay exactamente una imagen precargándose en
    // segundo plano.
    useEffect(() => {
      const proxima = siguienteIndice(estado.indice, fotos.length);
      setMontadas((prev) => (prev.has(proxima) ? prev : new Set(prev).add(proxima)));
    }, [estado.indice, fotos.length]);

    // El crossfade visual espera a que la imagen destino esté lista —
    // cargada con éxito o marcada como fallida. El fallback de marca
    // cuenta como "lista": no tiene sentido esperar algo que nunca va a
    // terminar de cargar, así que una imagen rota pasa al fallback
    // inmediatamente en su turno, sin intervalo vacío. Mientras el
    // destino no esté listo, `indiceVisible` no se mueve — la imagen
    // anterior sigue mostrándose.
    useEffect(() => {
      if (cargadas.has(estado.indice) || fallidas.has(estado.indice)) {
        setIndiceVisible(estado.indice);
      }
    }, [estado.indice, cargadas, fallidas]);

    useEffect(() => {
      if (!rotacionActiva(estado)) return;
      const id = setTimeout(() => dispatch({ tipo: "TICK" }), DURACION_ROTACION_MS);
      return () => clearTimeout(id);
    }, [estado]);

    // `touchstart` inicia la pausa temporal (igual que hover/foco).
    // `touchend` decide primero si hubo swipe y despacha la navegación
    // ANTES de terminar la pausa — si se despachara al revés, un swipe
    // justo en el límite de los 6s podría perderse contra un TICK que
    // ya estaba re-armándose. `touchcancel` (el dedo se arrastra fuera
    // del carrusel o el gesto se interrumpe) solo termina la pausa, sin
    // navegar. Ninguno de los tres toca `reproduciendo` — la pausa
    // persistente del botón nunca se altera por touch (ver Task 2,
    // "reducirCarrusel — secuencia de interacción táctil", que ya
    // prueba esta composición exacta a nivel de reducer).
    function manejarTouchStart(e: React.TouchEvent) {
      touchStartX.current = e.touches[0]?.clientX ?? null;
      dispatch({ tipo: "INTERACCION_INICIO" });
    }

    function manejarTouchEnd(e: React.TouchEvent) {
      if (touchStartX.current !== null) {
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        if (deltaX > UMBRAL_SWIPE_PX) dispatch({ tipo: "ANTERIOR" });
        else if (deltaX < -UMBRAL_SWIPE_PX) dispatch({ tipo: "SIGUIENTE" });
      }
      touchStartX.current = null;
      dispatch({ tipo: "INTERACCION_FIN" });
    }

    function manejarTouchCancel() {
      touchStartX.current = null;
      dispatch({ tipo: "INTERACCION_FIN" });
    }

    return (
      <div
        role="region"
        aria-roledescription="carrusel"
        aria-label="Fotos destacadas de ViandApp"
        className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-soft-teal lg:aspect-[16/11]"
        onMouseEnter={() => dispatch({ tipo: "INTERACCION_INICIO" })}
        onMouseLeave={() => dispatch({ tipo: "INTERACCION_FIN" })}
        onFocus={() => dispatch({ tipo: "INTERACCION_INICIO" })}
        onBlur={() => dispatch({ tipo: "INTERACCION_FIN" })}
        onTouchStart={manejarTouchStart}
        onTouchEnd={manejarTouchEnd}
        onTouchCancel={manejarTouchCancel}
      >
        {fotos.map((foto, i) => {
          if (!montadas.has(i)) return null;
          const visible = i === indiceVisible;
          return (
            <div
              key={foto.src}
              className="absolute inset-0 transition-opacity ease-in-out"
              style={{
                opacity: visible ? 1 : 0,
                transitionDuration: `${DURACION_CROSSFADE_MS}ms`,
              }}
              aria-hidden={!visible}
            >
              {fallidas.has(i) ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-soft-teal text-teal">
                  <IconPlato className="h-8 w-8" />
                  <span className="text-sm font-medium">ViandApp</span>
                </div>
              ) : (
                <Image
                  src={foto.src}
                  alt={foto.alt}
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  priority={i === 0}
                  className="object-cover"
                  onLoad={() => setCargadas((prev) => new Set(prev).add(i))}
                  onError={() => setFallidas((prev) => new Set(prev).add(i))}
                />
              )}
              {foto.esIlustrativa && !fallidas.has(i) && (
                <span className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-3 py-1 text-xs font-medium text-white">
                  Imagen ilustrativa
                </span>
              )}
            </div>
          );
        })}

        <button
          type="button"
          aria-label="Imagen anterior"
          onClick={() => dispatch({ tipo: "ANTERIOR" })}
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <IconFlechaIzquierda className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Imagen siguiente"
          onClick={() => dispatch({ tipo: "SIGUIENTE" })}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          <IconFlechaDerecha className="h-5 w-5" />
        </button>

        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          {fotos.map((foto, i) => (
            <button
              key={foto.src}
              type="button"
              aria-label={`Ir a imagen ${i + 1}`}
              aria-current={i === indiceVisible ? "true" : undefined}
              onClick={() => dispatch({ tipo: "IR_A", indice: i })}
              className={`h-11 w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                i === indiceVisible ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          aria-pressed={estado.reproduciendo}
          onClick={() => dispatch({ tipo: "ALTERNAR_REPRODUCCION" })}
          className="absolute right-2 top-2 flex h-11 min-w-[44px] items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-medium text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        >
          {estado.reproduciendo ? (
            <>
              <IconPausa className="h-4 w-4" /> Pausar presentación
            </>
          ) : (
            <>
              <IconReproducir className="h-4 w-4" /> Reanudar presentación
            </>
          )}
        </button>
      </div>
    );
  }
  ```

  Notas de implementación que fijan decisiones (no quedan abiertas):

  - **`priority`, no `preload`:** `next/image` en Next 16.3.1 no tiene
    ninguna prop `preload` — `priority` (booleana) sigue siendo la API
    vigente para marcar una imagen como prioritaria/no diferida, y es la
    que ya usa este componente (`priority={i === 0}`). No hay ningún
    cambio de API que hacer acá; lo que sí cambió respecto de la versión
    anterior de esta tarea es que las imágenes 2ª a 4ª ya no esperan a
    "volverse la actual" para empezar a pedirse — ahora se precarga
    exactamente la siguiente del ciclo por adelantado (ver el efecto de
    `montadas` arriba), sin marcarlas `priority`.
  - **`indiceVisible` vs. `estado.indice`:** el indicador activo y la
    opacidad del crossfade siguen a `indiceVisible` (lo que realmente se
    ve), no a `estado.indice` (a dónde se está navegando). Si el
    usuario toca un indicador cuya imagen todavía no cargó, ese
    indicador no se resalta como activo hasta que la imagen esté lista
    — es el mismo principio de "no ocultar lo actual hasta que lo
    próximo esté listo" aplicado también a los indicadores, no solo al
    crossfade.
  - Las rotaciones automáticas **no** llevan `aria-live` en ningún
    elemento — cumple la regla de la spec de no anunciar cada tick por
    región viva. No se agrega un anuncio de cambio manual tampoco: el
    `aria-label`/`aria-current` de los indicadores y el foco que ya
    recibe cada control al usarse alcanzan para que un lector de
    pantalla entienda el cambio sin un anuncio adicional — agregar
    `aria-live="polite"` encima sería redundante y no lo pide la spec
    como obligatorio.
  - `aria-pressed={estado.reproduciendo}` en el botón de reproducción:
    `true` cuando está reproduciendo (rotación activada), `false`
    cuando está pausado — el texto visible ya indica la acción
    disponible ("Pausar"/"Reanudar"), `aria-pressed` describe el estado
    actual del toggle para tecnología de asistencia.
  - El panel de fallback reutiliza `bg-soft-teal` + `IconPlato`, mismo
    lenguaje visual que el "Sin foto" de `DishCard`, sin inventar un
    ícono de imagen rota.

- [ ] **Paso 3: Verificar tipos, lint y espacios**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos (el `eslint-disable` de
  `react-hooks/exhaustive-deps` es intencional y ya sigue el patrón que
  usa el resto del proyecto para efectos de "solo al montar").

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 4: Commit**

  ```bash
  git add components/landing/icons.tsx components/landing/HeroCarousel.tsx
  git commit -m "feat: add accessible HeroCarousel client component"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 4. Este componente todavía no se renderiza en ninguna página — la
verificación visual en navegador se hace recién en Task 11, una vez que
Task 4 lo monta dentro de `PortadaHero`.

---

## Task 4: `PortadaHero` — hero, buscador reutilizado y filtros rápidos

**Files:**
- Create: `components/landing/HeroQuickFilters.tsx`
- Create: `components/landing/PortadaHero.tsx`

**Interfaces:**
- Consumes: `GlobalSearch` de `@/components/consumer/GlobalSearch`
  (sin cambios); `HeroCarousel` de `./HeroCarousel` (Task 3);
  `FOTOS_CARRUSEL` de `./carruselDatos` (Task 1).
- Produces: `export default function PortadaHero(): JSX.Element` — Task 9
  lo importa y lo monta como primer bloque de `app/(consumer)/page.tsx`.

Ambos son Server Components — ninguno usa `"use client"`.

- [ ] **Paso 1: Crear `components/landing/HeroQuickFilters.tsx`**

  ```tsx
  import Link from "next/link";

  const FILTROS_RAPIDOS = [
    { etiqueta: "Almuerzo", href: "/explorar?tipo=almuerzo" },
    { etiqueta: "Cena", href: "/explorar?tipo=cena" },
    { etiqueta: "Retiro", href: "/explorar?modalidad=retiro" },
    { etiqueta: "Envío", href: "/explorar?modalidad=envio" },
  ] as const;

  export default function HeroQuickFilters() {
    return (
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {FILTROS_RAPIDOS.map((filtro) => (
          <Link
            key={filtro.href}
            href={filtro.href}
            className="flex min-h-[44px] shrink-0 items-center rounded-full bg-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {filtro.etiqueta}
          </Link>
        ))}
      </div>
    );
  }
  ```

  Los 4 `href` usan exactamente los nombres de parámetro (`tipo`,
  `modalidad`) y valores (`almuerzo`, `cena`, `retiro`, `envio`) que ya
  valida `parsearFiltros` en `lib/viandas/filtros.ts` — este componente
  no importa ni duplica esa función, solo arma el enlace (Global
  Constraints de la spec).

- [ ] **Paso 2: Crear `components/landing/PortadaHero.tsx`**

  ```tsx
  import GlobalSearch from "@/components/consumer/GlobalSearch";
  import HeroCarousel from "./HeroCarousel";
  import HeroQuickFilters from "./HeroQuickFilters";
  import { FOTOS_CARRUSEL } from "./carruselDatos";

  export default function PortadaHero() {
    return (
      <section className="bg-teal">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:py-20">
          <div className="flex flex-col gap-5">
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-white/70">
              Rafaela, Santa Fe
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl">
              Hoy no cocines. Elegí casero.
            </h1>
            <p className="max-w-xl text-lg text-white/85">
              Encontrá viandas preparadas por cocinas de Rafaela. Mirá el
              menú y coordiná directo por WhatsApp.
            </p>
            <div className="mt-2 flex flex-col gap-3">
              <GlobalSearch initialQuery="" />
              <HeroQuickFilters />
            </div>
          </div>

          <HeroCarousel fotos={FOTOS_CARRUSEL} />
        </div>
      </section>
    );
  }
  ```

- [ ] **Paso 3: Verificar tipos, lint y espacios**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos.

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 4: Commit**

  ```bash
  git add components/landing/HeroQuickFilters.tsx components/landing/PortadaHero.tsx
  git commit -m "feat: add PortadaHero composing search, quick filters and carousel"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 5.

---

## Task 5: Header global y nombres accesibles únicos

**Files:**
- Modify: `components/layout/Header.tsx`
- Modify: `components/consumer/MobileBottomNav.tsx`

**Interfaces:**
- Consumes: nada nuevo — `Header.tsx` ya usa `createClient` de
  `@/lib/supabase/server` y `Link` de `next/link`.
- Produces: nada que otra tarea de este plan importe — ambos son
  componentes ya usados globalmente vía `app/layout.tsx` (`Header`) y
  `ConsumerShell`/Task 9 (`MobileBottomNav`).

- [ ] **Paso 1: Modificar `components/layout/Header.tsx`**

  Reemplazar el `<nav>` actual (que hoy solo tiene el enlace "Sumarte
  como viandera" + Ingresar/Mi cuenta) por:

  ```tsx
  <nav aria-label="Navegación global" className="flex items-center gap-4 sm:gap-6">
    <Link
      href="/explorar"
      className="hidden py-3 text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:block"
    >
      Explorar
    </Link>
    <Link
      href="/#como-funciona"
      className="hidden py-3 text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:block"
    >
      Cómo funciona
    </Link>
    <Link
      href="/#sumate"
      className="hidden py-3 text-sm font-medium text-ink/70 transition-colors hover:text-ink lg:block"
    >
      Sumar mi cocina
    </Link>
    {user ? (
      <Link
        href="/app"
        className="rounded-full border border-ink/15 px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-card"
      >
        Mi cuenta
      </Link>
    ) : (
      <Link
        href="/login"
        className="rounded-full bg-coral px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-coral-600 hover:shadow-md active:scale-95"
      >
        Ingresar
      </Link>
    )}
  </nav>
  ```

  Los tres enlaces intermedios usan `hidden ... lg:block` (no
  `sm:block`, que era el breakpoint del texto "Sumarte como viandera"
  que reemplazan) — recién visibles desde 1024 px, dejando debajo de eso
  solo logo + Ingresar/Mi cuenta, cubierto por `MobileBottomNav` para
  Explorar/Sumar mi cocina.

- [ ] **Paso 2: Modificar `components/consumer/MobileBottomNav.tsx`**

  Cambiar únicamente la línea del `aria-label`:

  ```tsx
  aria-label="Navegación principal móvil"
  ```

  en vez de:

  ```tsx
  aria-label="Navegación principal"
  ```

  Sin ningún otro cambio en el archivo — mismos `ITEMS`, mismo
  `lg:hidden`, mismo `data-consumer-bottom-nav`.

- [ ] **Paso 3: Verificar tipos, lint y espacios**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos.

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 4: Verificación manual mínima de no-regresión en `/explorar`**

  Con `npm run dev` corriendo, visitar `/explorar` y confirmar que el
  header y `MobileBottomNav` se ven y funcionan igual que antes de este
  cambio (los `aria-label` no son visibles, pero la navegación sí debe
  comportarse igual). Esta verificación puntual se repite formalmente en
  Task 11; acá es solo para no arrastrar una regresión a las tareas
  siguientes.

- [ ] **Paso 5: Commit**

  ```bash
  git add components/layout/Header.tsx components/consumer/MobileBottomNav.tsx
  git commit -m "feat: expand global header nav and give landmarks unique names"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 6. Como este cambio toca dos componentes compartidos con
`/explorar`, Codex revisa especialmente que esa ruta no se vea afectada.

---

## Task 6: Franja de valor y recorrido consumidor

**Files:**
- Create: `components/landing/FranjaValor.tsx`
- Create: `components/landing/RecorridoConsumidor.tsx`

**Interfaces:**
- Consumes: `IconPlato`, `IconMoneda`, `IconPin` de `./icons` (ya
  existen, sin cambios).
- Produces: `export default function FranjaValor(): JSX.Element` y
  `export default function RecorridoConsumidor(): JSX.Element` — Task 9
  los importa y monta en `app/(consumer)/page.tsx`.

Ambos Server Components, sin `Reveal` (Global Constraints).

- [ ] **Paso 1: Crear `components/landing/FranjaValor.tsx`**

  ```tsx
  import { IconMoneda, IconPin, IconPlato } from "./icons";

  const ITEMS_VALOR = [
    { Icon: IconPlato, texto: "Directo a la cocina" },
    { Icon: IconMoneda, texto: "Sin comisiones" },
    { Icon: IconPin, texto: "Hecho en Rafaela" },
  ] as const;

  export default function FranjaValor() {
    return (
      <section className="bg-soft-teal">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-center sm:gap-12 sm:px-6">
          {ITEMS_VALOR.map(({ Icon, texto }) => (
            <div key={texto} className="flex items-center gap-3">
              <Icon className="h-6 w-6 shrink-0 text-teal" />
              <span className="font-display text-base font-semibold text-ink">
                {texto}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  ```

- [ ] **Paso 2: Crear `components/landing/RecorridoConsumidor.tsx`**

  ```tsx
  const PASOS_CONSUMIDOR = [
    {
      numero: "1",
      titulo: "Explorá",
      texto: "Buscá por nombre de plato o filtrá por almuerzo, cena, retiro o envío.",
    },
    {
      numero: "2",
      titulo: "Elegí tu plato",
      texto: "Mirá el menú completo de cada cocina: fotos, precios y etiquetas dietarias.",
    },
    {
      numero: "3",
      titulo: "Coordiná por WhatsApp",
      texto: "Confirmás disponibilidad y entrega directo con la cocina, sin intermediarios.",
    },
  ] as const;

  export default function RecorridoConsumidor() {
    return (
      <section id="como-funciona" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold text-ink">
          ¿Cómo funciona?
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
          {PASOS_CONSUMIDOR.map((paso) => (
            <div key={paso.numero} className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-coral font-display text-lg font-bold text-white">
                {paso.numero}
              </div>
              <h3 className="font-display text-lg font-semibold text-ink">
                {paso.titulo}
              </h3>
              <p className="text-sm text-ink/65">{paso.texto}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  ```

  `id="como-funciona"` con `scroll-mt-20` (mismo patrón que ya usa
  `id="sumate"` en la landing actual) es el destino del enlace "Cómo
  funciona" del header (Task 5).

- [ ] **Paso 3: Verificar tipos, lint y espacios**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos.

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 4: Commit**

  ```bash
  git add components/landing/FranjaValor.tsx components/landing/RecorridoConsumidor.tsx
  git commit -m "feat: add value strip and consumer journey sections"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 7.

---

## Task 7: `DescubriHoy` — sección de platos destacados

**Files:**
- Create: `lib/viandas/destacados.ts`
- Create: `lib/viandas/destacados.test.ts`
- Create: `components/landing/DescubriHoy.tsx`

**Interfaces:**
- Consumes: `buscarPlatos`/`ResultadoPlato` de `@/lib/viandas/consultas`
  (sin modificarlos); `DishCard` de `@/components/consumer/DishCard` (sin
  cambios); `ResultsSkeleton` de `@/components/consumer/ResultsSkeleton`
  (sin cambios).
- Produces: `ResultadoDestacados`, `clasificarDestacados(buscar: () =>
  Promise<ResultadoPlato[]>, limite: number): Promise<ResultadoDestacados>`
  de `@/lib/viandas/destacados` (consumido solo dentro de esta misma
  tarea, por `DescubriHoy.tsx`) y `export default async function
  DescubriHoy(): Promise<JSX.Element>` — Task 9 lo monta envuelto en su
  propio `<Suspense>`.

`clasificarDestacados` es la pieza pura y testeable de esta tarea:
recibe la función de búsqueda como dependencia inyectable, así los tests
cubren resultado/vacío/error sin tocar Supabase, sin jsdom y sin
depender de `.env*`. `DescubriHoy.tsx` queda como una capa fina que solo
decide qué JSX mostrar para cada uno de los tres estados que ya vienen
clasificados — no se prueba con Vitest (mismo criterio que el resto de
componentes de esta portada), se verifica con `tsc`/`lint`/`build` y QA
manual en Task 11.

- [ ] **Paso 1: Escribir el test que falla — `clasificarDestacados`**

  Crear `lib/viandas/destacados.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest";
  import { clasificarDestacados } from "./destacados";
  import type { ResultadoPlato } from "./consultas";

  function platoFalso(id: string): ResultadoPlato {
    return {
      id,
      nombre: `Plato ${id}`,
      descripcion: null,
      precio: 1000,
      tipo: "almuerzo",
      fotoUrl: null,
      etiquetas: [],
      viandera: {
        nombre: "Cocina de prueba",
        slug: "cocina-de-prueba",
        barrio: null,
        ofreceRetiro: true,
        ofreceEnvio: false,
      },
    };
  }

  describe("clasificarDestacados", () => {
    it("devuelve 'resultado' con los platos recortados al límite", async () => {
      const platos = [platoFalso("1"), platoFalso("2"), platoFalso("3")];
      const resultado = await clasificarDestacados(async () => platos, 2);
      expect(resultado).toEqual({ estado: "resultado", platos: platos.slice(0, 2) });
    });

    it("no recorta si hay menos platos que el límite", async () => {
      const platos = [platoFalso("1")];
      const resultado = await clasificarDestacados(async () => platos, 8);
      expect(resultado).toEqual({ estado: "resultado", platos });
    });

    it("devuelve 'vacio' cuando la búsqueda resuelve sin platos", async () => {
      const resultado = await clasificarDestacados(async () => [], 8);
      expect(resultado).toEqual({ estado: "vacio" });
    });

    it("devuelve 'error' cuando la búsqueda rechaza", async () => {
      const resultado = await clasificarDestacados(async () => {
        throw new Error("fallo simulado");
      }, 8);
      expect(resultado).toEqual({ estado: "error" });
    });
  });
  ```

- [ ] **Paso 2: Correr el test y confirmar que falla**

  ```bash
  npx vitest run lib/viandas/destacados.test.ts
  ```

  Esperado: falla con un error de módulo no encontrado (`Cannot find
  module './destacados'` o equivalente) — `lib/viandas/destacados.ts`
  todavía no existe.

- [ ] **Paso 3: Implementar `clasificarDestacados`**

  Crear `lib/viandas/destacados.ts`:

  ```ts
  import type { ResultadoPlato } from "./consultas";

  export type ResultadoDestacados =
    | { estado: "resultado"; platos: ResultadoPlato[] }
    | { estado: "vacio" }
    | { estado: "error" };

  /**
   * Clasifica el resultado de una búsqueda de platos destacados en uno
   * de tres estados honestos — nunca confunde "sin platos cargados" con
   * "la consulta falló". `buscar` es inyectable a propósito: en
   * producción es `() => buscarPlatos(FILTROS_SIN_RESTRICCIONES)`, en
   * tests es un stub que no toca Supabase.
   */
  export async function clasificarDestacados(
    buscar: () => Promise<ResultadoPlato[]>,
    limite: number,
  ): Promise<ResultadoDestacados> {
    let platos: ResultadoPlato[];
    try {
      platos = await buscar();
    } catch {
      return { estado: "error" };
    }
    const recortados = platos.slice(0, limite);
    if (recortados.length === 0) return { estado: "vacio" };
    return { estado: "resultado", platos: recortados };
  }
  ```

- [ ] **Paso 4: Correr el test y confirmar que pasa**

  ```bash
  npx vitest run lib/viandas/destacados.test.ts
  ```

  Esperado: los 4 tests en verde.

- [ ] **Paso 5: Crear `components/landing/DescubriHoy.tsx`**

  ```tsx
  import Link from "next/link";
  import DishCard from "@/components/consumer/DishCard";
  import { buscarPlatos } from "@/lib/viandas/consultas";
  import { clasificarDestacados } from "@/lib/viandas/destacados";

  const CANTIDAD_DESTACADOS = 8;
  const FILTROS_SIN_RESTRICCIONES = {
    q: "",
    tipo: "todos",
    etiqueta: null,
    modalidad: "todas",
  } as const;

  export default async function DescubriHoy(): Promise<JSX.Element> {
    // `buscarPlatos` no se atrapa acá directamente — `clasificarDestacados`
    // ya decide resultado/vacío/error de forma pura y testeada (Pasos
    // 1-4). A diferencia de `/explorar` (donde un error se deja
    // propagar a `error.tsx` porque la búsqueda es la página completa),
    // acá el error se convierte en un estado más porque esta sección es
    // una entre muchas — un fallo no puede tumbar el hero ni el
    // formulario de cocinas fundadoras.
    const resultado = await clasificarDestacados(
      () => buscarPlatos(FILTROS_SIN_RESTRICCIONES),
      CANTIDAD_DESTACADOS,
    );

    if (resultado.estado === "error") {
      return (
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-ink">
            Descubrí qué hay para hoy
          </h2>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            No pudimos cargar los platos disponibles ahora mismo. Volvé a
            intentarlo en un rato. También podés probar en{" "}
            <Link href="/explorar" className="font-medium text-coral-600 underline-offset-2 hover:underline">
              /explorar
            </Link>
            , aunque puede tener el mismo problema por ahora.
          </p>
        </section>
      );
    }

    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl font-bold text-ink">
          Descubrí qué hay para hoy
        </h2>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Los menús pueden cambiar — confirmá disponibilidad por WhatsApp
          antes de coordinar.
        </p>

        {resultado.estado === "vacio" ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-lg font-medium text-ink">
              Todavía estamos sumando las primeras cocinas de Rafaela.
            </p>
            <p className="max-w-md text-sm text-ink-muted">
              ¿Cocinás vos?{" "}
              <Link href="/#sumate" className="font-medium text-coral-600 underline-offset-2 hover:underline">
                Sumate más abajo
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resultado.platos.map((plato) => (
              <DishCard key={plato.id} plato={plato} />
            ))}
          </div>
        )}
      </section>
    );
  }
  ```

  `DescubriHoy` declara explícitamente `Promise<JSX.Element>` (es
  `async`, así que ese es su tipo de retorno real — no
  `JSX.Element` síncrono) y el enlace "Sumate más abajo" usa `<Link
  href="/#sumate">` de `next/link`, no `<a>`, igual que el enlace a
  `/explorar` del estado de error.

- [ ] **Paso 6: Verificar tipos, lint y espacios**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos.

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 7: Commit**

  ```bash
  git add lib/viandas/destacados.ts lib/viandas/destacados.test.ts components/landing/DescubriHoy.tsx
  git commit -m "feat: add DescubriHoy featured dishes section with a testable result classifier"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 8. Codex revisa especialmente que `clasificarDestacados` no importe
nada de Supabase directamente (solo recibe la función de búsqueda
inyectada), que el estado de error no presente `/explorar` como solución
garantizada, y que la aclaración de menús esté antes de la grilla, no
después.

---

## Task 8: `CocinasFundadoras` — sección de captación reutilizando el formulario

**Files:**
- Create: `components/landing/CocinasFundadoras.tsx`

**Interfaces:**
- Consumes: `FormularioInteres` de `./FormularioInteres` (sin ningún
  cambio a ese archivo ni a `anotarseComoInteresada`).
- Produces: `export default function CocinasFundadoras(): JSX.Element` —
  Task 9 lo monta en `app/(consumer)/page.tsx`.

Server Component — envuelve un Client Component existente
(`FormularioInteres`) sin agregar ningún Client Component nuevo (Global
Constraints).

- [ ] **Paso 1: Crear `components/landing/CocinasFundadoras.tsx`**

  ```tsx
  import FormularioInteres from "./FormularioInteres";

  export default function CocinasFundadoras() {
    return (
      <section id="sumate" className="mx-auto w-full max-w-2xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="rounded-full bg-mostaza/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mostaza-700">
            Cocina fundadora
          </span>
          <h2 className="font-display text-3xl font-bold text-ink">
            ¿Cocinás? Sé de las primeras en aparecer en ViandApp.
          </h2>
          <p className="max-w-md text-ink/70">
            Sin comisiones, sin depender de apps de delivery ni de
            publicar a mano en cada grupo de WhatsApp.
          </p>
        </div>
        <div className="mt-10">
          <FormularioInteres />
        </div>
      </section>
    );
  }
  ```

  `id="sumate"` se mantiene idéntico al que ya usan `Header.tsx` y
  `Footer.tsx` con `/#sumate` — no hace falta tocar esos enlaces, ya
  apuntan bien.

  El token `mostaza-700` no existe hoy en `tailwind.config.ts` (la
  escala de `mostaza` llega hasta `900` pero no todos los pasos
  intermedios están garantizados por Tailwind v4 si no se generan — para
  no depender de un tono no verificado, usar en su lugar `text-ink`
  sobre `bg-mostaza/20`, que sí usa solo tokens confirmados:

  ```tsx
  <span className="rounded-full bg-mostaza/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink">
    Cocina fundadora
  </span>
  ```

  (reemplaza la línea del badge de arriba — esta es la versión final a
  implementar, la anterior queda descartada para no introducir una
  clase de color no verificada).

- [ ] **Paso 2: Verificar tipos, lint y espacios**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos.

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 3: Commit**

  ```bash
  git add components/landing/CocinasFundadoras.tsx
  git commit -m "feat: add CocinasFundadoras wrapping the existing signup form"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 9. Codex revisa especialmente que `FormularioInteres` no se haya
tocado y que el `id="sumate"` siga siendo exactamente ese.

---

## Task 9: Composición final de `app/(consumer)/page.tsx`, metadata y montaje de `MobileBottomNav`

**Files:**
- Modify: `app/(consumer)/page.tsx`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `PortadaHero` (Task 4), `FranjaValor` y `RecorridoConsumidor`
  (Task 6), `DescubriHoy` (Task 7), `CocinasFundadoras` (Task 8),
  `MobileBottomNav` de `@/components/consumer/MobileBottomNav` (Task 5,
  ya con su `aria-label` actualizado).
- Produces: la portada completa en `/`. Ninguna tarea posterior de este
  plan importa nada de este archivo (es la hoja del árbol de
  composición).

- [ ] **Paso 1: Reescribir `app/(consumer)/page.tsx`**

  ```tsx
  import type { Metadata } from "next";
  import { Suspense } from "react";
  import PortadaHero from "@/components/landing/PortadaHero";
  import FranjaValor from "@/components/landing/FranjaValor";
  import DescubriHoy from "@/components/landing/DescubriHoy";
  import CocinasFundadoras from "@/components/landing/CocinasFundadoras";
  import RecorridoConsumidor from "@/components/landing/RecorridoConsumidor";
  import ResultsSkeleton from "@/components/consumer/ResultsSkeleton";
  import MobileBottomNav from "@/components/consumer/MobileBottomNav";

  export const metadata: Metadata = {
    title: "ViandApp — Viandas caseras en Rafaela, directo por WhatsApp",
    description:
      "Encontrá viandas preparadas por cocinas de Rafaela. Mirá el menú y coordiná directo por WhatsApp.",
  };

  export default function HomePage() {
    return (
      <div className="flex flex-col overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <PortadaHero />
        <FranjaValor />
        <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6"><ResultsSkeleton /></div>}>
          <DescubriHoy />
        </Suspense>
        <CocinasFundadoras />
        <RecorridoConsumidor />
        <MobileBottomNav />
      </div>
    );
  }
  ```

  Notas de implementación que fijan decisiones:

  - El `pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0` en el
    `<div>` raíz es el mismo cálculo que ya usa `ConsumerShell` para
    `/explorar` — con `MobileBottomNav` montado acá, el `body:has(...)`
    de `app/globals.css` ya reserva el espacio del footer global; este
    padding adicional evita que el contenido de la propia página quede
    tapado por la barra fija en mobile, igual que en `/explorar`.
  - `RecorridoConsumidor` va después de `CocinasFundadoras` (no antes)
    para que el `scroll-mt-20` de `id="como-funciona"` deje la sección
    justo debajo del fold visible al llegar por el enlace del header —
    el orden entre estas dos no afecta ningún criterio de la spec (la
    spec no fija su posición relativa una respecto de la otra, solo que
    ambas estén presentes).
  - `title`/`description` siguen la propuesta de la sección 13 de la
    spec.

- [ ] **Paso 2: Agregar la entrada correspondiente a `CLAUDE.md`**

  En la sección "Estado del proyecto", después del párrafo de
  "Explorador de consumidores..." (el más reciente), agregar:

  ```markdown
  Portada comercial (agregada 2026-09-03, tras el lanzamiento del
  explorador): `/` deja de ser una landing 100% orientada a captar
  vianderas — pasa a ser consumidor-first, con el mensaje "Hoy no
  cocines. Elegí casero.", buscador y filtros rápidos hacia
  `/explorar`, un carrusel fotográfico de imágenes locales
  (`public/portada/`, créditos en `public/portada/CREDITOS.md`) y una
  sección "Descubrí qué hay para hoy" alimentada con `buscarPlatos`
  real. La captación de cocinas sigue existiendo — sección "Cocinas
  fundadoras" más abajo en la misma página, reutilizando sin cambios el
  formulario y la Server Action que ya insertaban en
  `interesados_viandera`. El header global ahora tiene `aria-label`
  distinto de `MobileBottomNav` (`"Navegación global"` vs "Navegación
  principal móvil"). Sin mapa, analítica conectada ni cambios de
  Supabase en esta entrega — ver
  `docs/superpowers/specs/2026-09-03-viandapp-portada-comercial-design.md`.
  ```

- [ ] **Paso 3: Levantar el dev server y verificar que la portada carga**

  ```bash
  npm run dev
  ```

  Visitar `http://localhost:3000/` y confirmar visualmente que se ve la
  composición completa (hero teal, franja de valor, "Descubrí qué hay
  para hoy", cocinas fundadoras, recorrido, footer, `MobileBottomNav` en
  mobile) sin errores en la consola del navegador. Esta es una
  verificación de humo — la QA completa por breakpoint/accesibilidad/
  Lighthouse es la Task 11.

- [ ] **Paso 4: Verificar tipos, lint, build y espacios**

  ```bash
  npx tsc --noEmit
  ```

  Esperado: sin errores.

  ```bash
  npm run lint
  ```

  Esperado: sin errores ni warnings nuevos.

  ```bash
  npm run build
  ```

  Esperado: build de producción exitoso, sin errores — esto también
  confirma que Next genera correctamente los tipos de `LayoutProps`
  para la ruta `/` reescrita.

  ```bash
  git diff --check
  ```

  Esperado: sin salida.

- [ ] **Paso 5: Commit**

  ```bash
  git add "app/(consumer)/page.tsx" CLAUDE.md
  git commit -m "feat: compose the new commercial homepage at /"
  ```

**Punto de detención:** esperar revisión de Codex antes de avanzar a la
Task 10. A partir de acá la portada está funcionalmente completa —
Codex puede pedir ajustes de composición antes de la ronda de
verificación final.

---

## Task 10: Pruebas automatizadas y verificación de regresiones

**Files:** ninguno nuevo — corre la suite completa del repositorio tal
como quedó después de las Tasks 1 a 9.

**Interfaces:**
- Consumes: toda la suite existente (`lib/analitica/eventos.test.ts`,
  `lib/viandas/consultas.test.ts`, `lib/viandas/filtros.test.ts`,
  `lib/viandera/slug.test.ts`) más `lib/carrusel/reproduccion.test.ts`
  (Task 2) y `lib/viandas/destacados.test.ts` (Task 7).
- Produces: confirmación de que ninguna tarea anterior rompió nada fuera
  de su propio alcance.

- [ ] **Paso 1: Suite completa**

  ```bash
  npm test
  ```

  Esperado: 100% de los tests en verde, incluidos los 4 archivos
  preexistentes y `lib/carrusel/reproduccion.test.ts` de la Task 2 — cero
  regresiones.

- [ ] **Paso 2: Tipos, lint y build de producción, repositorio completo**

  ```bash
  npx tsc --noEmit
  ```

  ```bash
  npm run lint
  ```

  ```bash
  npm run build
  ```

  Esperado: los tres comandos terminan sin errores.

- [ ] **Paso 3: `git diff --check` sobre todo lo acumulado desde el inicio del plan**

  ```bash
  git diff --check main
  ```

  Esperado: sin salida — confirma que ningún commit de las 9 tareas
  anteriores introdujo espacios en blanco inválidos.

- [ ] **Paso 4: Confirmar por grep que ninguna tarea conectó analítica ni tocó Supabase**

  ```bash
  git diff main -- 'app/**' 'components/**' 'lib/**' | grep -n "eventos_analitica\|registrarEvento\|lib/analitica" || echo "sin coincidencias"
  ```

  Esperado: `sin coincidencias` — ninguna línea agregada por este plan
  menciona `eventos_analitica` ni funciones de `lib/analitica/`.

  ```bash
  git diff main -- 'supabase/**' | head -1
  ```

  Esperado: sin salida — ningún archivo bajo `supabase/` cambió.

- [ ] **Paso 5: Confirmar que `DishCard` no se tocó**

  ```bash
  git diff main -- components/consumer/DishCard.tsx | head -1
  ```

  Esperado: sin salida.

Esta tarea no genera un commit propio — es un checkpoint de verificación
sobre el trabajo ya commiteado en las Tasks 1 a 9. Si cualquiera de los
comandos de arriba falla, se corrige en la tarea original que introdujo
el problema (no acá) y se vuelve a correr este checklist completo.

**Punto de detención:** esperar confirmación de Codex de que el
checklist de regresión está limpio antes de avanzar a la Task 11 (QA
manual/Lighthouse).

---

## Task 11: QA responsive, accesibilidad, Lighthouse, build de producción y checklist previo al despliegue

**Files:** ninguno — tarea de verificación manual, sin cambios de código
salvo que aparezca un defecto (ver Paso 8).

- [ ] **Paso 1: Responsive en los 6 anchos requeridos**

  Con `npm run dev` corriendo, en el navegador (DevTools responsive o
  Browser pane), visitar `/` en **320, 375, 640, 768, 1024 y 1440 px** y
  para cada uno confirmar:
  - Sin scroll horizontal.
  - Objetivos táctiles ≥ 44×44 px (buscador, filtros rápidos, flechas/
    indicadores/botón de reproducción del carrusel, enlaces del header,
    ítems de `MobileBottomNav`, campos y botón del formulario).
  - Hero apilado en mobile, dos columnas desde `lg`.
  - Header: solo logo + Ingresar/Mi cuenta por debajo de 1024 px; los
    tres enlaces intermedios visibles junto a Ingresar/Mi cuenta desde
    1024 px.
  - `MobileBottomNav` visible por debajo de `lg`, oculto desde `lg`.

- [ ] **Paso 2: Header — con sesión y sin sesión, en 640/768/1024 px**

  Repetir la verificación del header (Paso 1) logueado (vía `/login`) y
  sin loguear, en 640, 768 y 1024 px — confirmar que "Ingresar"/"Mi
  cuenta" alterna correctamente en ambos casos y que el breakpoint de
  los 3 enlaces intermedios no cambia según sesión.

- [ ] **Paso 3: Carrusel — reproducción, semántica y fallback**

  - Confirmar rotación cada 6 s y crossfade de ~500 ms.
  - Confirmar que "Pausar presentación"/"Reanudar presentación" funciona
    por click y por teclado (Tab hasta el botón + Enter/Espacio), que su
    estado persiste al mover el mouse fuera del carrusel o quitar el
    foco, y que hover/foco por sí solos no cambian el texto del botón.
  - Con las herramientas de DevTools, emular `prefers-reduced-motion:
    reduce` y recargar — confirmar que el botón arranca en "Reanudar
    presentación" y que la imagen no rota sola; confirmar que tocar el
    botón sí la pone a rotar.
  - Con `read_page`/inspección del DOM, confirmar `aria-label="Imagen
    anterior"`/`"Imagen siguiente"` en las flechas, `aria-label="Ir a
    imagen N"` + `aria-current="true"` en el indicador activo, y
    `role="region"`/`aria-roledescription="carrusel"` en el contenedor.
  - Forzar el fallo de una imagen (renombrar temporalmente un archivo en
    `public/portada/` en un entorno de prueba, o bloquear la request
    desde DevTools) y confirmar que esa posición muestra el panel
    `bg-soft-teal` con `IconPlato` + "ViandApp", no un ícono roto ni un
    hueco en blanco — revertir el cambio temporal después de probarlo.
  - Confirmar swipe en un dispositivo/emulación táctil real. Con
    emulación táctil, confirmar además que iniciar un toque
    (`touchstart`) pausa temporalmente la rotación, que soltar
    (`touchend`) — con o sin swipe — la reanuda si seguía en
    reproducción, y que cancelar el toque a mitad de gesto
    (`touchcancel`, ej. arrastrando el dedo fuera del carrusel) también
    la reanuda sin navegar. Confirmar que ninguno de estos tres eventos
    cambia el texto del botón "Pausar/Reanudar presentación".
  - **Conexión lenta:** con DevTools → Network → Throttling en "Slow 3G"
    (o equivalente), recargar y disparar una transición (flecha o
    automática) — confirmar que la imagen anterior permanece visible
    hasta que la próxima termina de cargar, nunca un intervalo con hueco
    en blanco ni un salto a una imagen a medio cargar. Con la misma
    configuración, bloquear específicamente la request de la próxima
    imagen desde el panel Network y confirmar que, al llegarle el turno,
    se muestra el panel de fallback de marca inmediatamente, sin
    intervalo vacío.

- [ ] **Paso 4: `DescubriHoy` — resultado, vacío y error (reproducible y
      reversible)**

  La clasificación resultado/vacío/error ya está cubierta por 4 tests en
  `lib/viandas/destacados.test.ts` (Task 7) sin tocar Supabase, jsdom ni
  `.env*` — acá se verifica solo la **representación visual** de cada
  estado, con dos mecanismos reproducibles que tampoco tocan `.env.local`
  ni datos reales:

  - **Resultado (datos reales):** con `npm run dev` corriendo contra el
    Supabase real, confirmar que la sección muestra los platos
    existentes enlazando a su `/{slug}`, y que "Los menús pueden
    cambiar — confirmá disponibilidad por WhatsApp antes de coordinar."
    aparece inmediatamente debajo del título, antes de la grilla.
  - **Vacío:** cambiar temporalmente `CANTIDAD_DESTACADOS` a `0` en
    `components/landing/DescubriHoy.tsx`, correr `npm run dev`, visitar
    `/` y confirmar el mensaje de invitación al piloto sin platos
    inventados — **revertir el cambio** (volver a `8`) antes de seguir;
    ese `0` nunca se commitea.
  - **Error:** en una terminal aparte, sin editar ningún archivo
    `.env*` en disco, correr:

    ```bash
    NEXT_PUBLIC_SUPABASE_URL="https://qa-invalida.supabase.co" npm run dev
    ```

    La variable de entorno solo existe para ese proceso puntual —
    termina con Ctrl+C y no deja rastro en ningún archivo. Visitar `/` y
    confirmar el mensaje de reintento sin presentar `/explorar` como
    solución garantizada, visualmente distinto del estado vacío. Cerrar
    ese proceso y volver a levantar `npm run dev` normal (sin el
    prefijo) para seguir con el resto del checklist.

- [ ] **Paso 5: Formulario de cocinas fundadoras — validación segura**

  **No se inserta ningún lead sintético en el Supabase de producción
  como parte de este plan.** La escritura real solo puede probarse en
  uno de estos dos casos, ninguno obligatorio para cerrar esta tarea:

  1. Contra un proyecto de Supabase local/staging autorizado para
     pruebas, si existe uno.
  2. Con un interesado real, enviado por el usuario al formulario en
     producción por su propia decisión — nunca generado por quien
     ejecuta este plan.

  Sin ninguno de los dos disponibles, la verificación de regresión de
  esta tarea se limita a:

  - `npm run build` ya pasó en la Task 9 — confirma que el formulario
    sigue compilando sin errores.
  - Confirmar que `app/(consumer)/actions.ts` no aparece en el diff de
    ninguna tarea de este plan: `git diff main -- "app/(consumer)/actions.ts"`
    sin salida — la Server Action `anotarseComoInteresada` sigue
    exactamente igual que antes de este plan.
  - **Prueba de UI sin envío real:** con `npm run dev`, completar los
    campos del formulario en el navegador y confirmar que la validación
    de campos requeridos (nombre, contacto) funciona — sin tocar el
    botón "Quiero anotarme". Confirma que el formulario renderiza y
    valida igual que antes, sin generar ninguna fila nueva en
    `interesados_viandera`.

  **La escritura real contra producción queda marcada como validación
  operativa que requiere autorización explícita del usuario**, igual que
  cualquier otra escritura a la base real de este proyecto (mismo
  criterio ya usado en el lanzamiento del explorador) — se pide aparte,
  nunca se asume dentro de este plan. Ninguna fila real de
  `interesados_viandera` se borra ni se altera en ninguna tarea de este
  plan, tampoco a modo de "limpieza" de una prueba anterior.

- [ ] **Paso 6: Accesibilidad — teclado, contraste, zoom**

  - Navegar toda la portada solo con teclado (Tab/Shift+Tab/Enter/
    Espacio): header, buscador, filtros rápidos, carrusel completo
    (flechas, indicadores, botón de reproducción), formulario,
    `RecorridoConsumidor`, `MobileBottomNav`. Confirmar foco visible en
    todos y un orden de tabulación lógico.
  - Verificar contraste AA con una herramienta automática (ej. el
    panel de accesibilidad de DevTools) sobre el hero `teal` y sobre el
    resto de la página.
  - Zoom de texto al 200% en 640, 768 y 1024 px — confirmar que ningún
    texto se corta ni se superpone, y que el layout del hero reflowea
    correctamente.

- [ ] **Paso 7: Lighthouse / Core Web Vitals sobre build de producción**

  ```bash
  npm run build
  npm run start
  ```

  Con el servidor de producción corriendo en otra terminal, en la misma
  máquina y navegador que se use para comparar antes/después:

  ```bash
  npx lighthouse http://localhost:3000 --only-categories=performance --output=json --output-path=.tmp-lighthouse-portada.json --chrome-flags="--headless"
  ```

  Este comando corre en modo mobile por defecto (el preset por defecto
  de Lighthouse es mobile — no hace falta ningún flag de preset
  adicional). Leer el resultado del archivo JSON generado:

  ```bash
  grep -o '"score":[0-9.]*' .tmp-lighthouse-portada.json | head -1
  grep -o '"largest-contentful-paint":{[^}]*"numericValue":[0-9.]*' .tmp-lighthouse-portada.json
  ```

  Confirmar:
  - Performance ≥ 90 (el `score` viene en escala 0–1 — `0.92` = 92).
  - LCP ≤ 2500 (el `numericValue` de `largest-contentful-paint` viene en
    milisegundos).

  Borrar el archivo temporal apenas se leyeron los resultados — **nunca
  se commitea**:

  ```bash
  rm .tmp-lighthouse-portada.json
  git status
  ```

  Confirmar que `git status` no lo lista de ninguna forma (ni siquiera
  como untracked) — si algo queda listado, revisar por qué antes de
  seguir.

  Adicionalmente, en la pestaña Network de DevTools, confirmar que la
  primera imagen del carrusel se pide con prioridad alta
  (`fetchpriority=high` o equivalente, visible en la columna "Priority")
  y que la 2ª a 4ª no se piden hasta que el carrusel avanza hasta ellas
  o hasta que el mecanismo de precarga-una-por-delante de Task 3 las
  pide en segundo plano — nunca las cuatro con prioridad alta al mismo
  tiempo.

  Si el presupuesto no se cumple, el defecto se corrige en la tarea de
  origen correspondiente (ej. Task 3 si el problema es el carrusel) y
  se repite este paso — no se relaja el número.

- [ ] **Paso 8: Consola limpia en todas las rutas tocadas**

  Con una pestaña de navegador nueva (para evitar logs acumulados de
  pasos anteriores), visitar `/`, `/explorar`, `/login`, `/registro`,
  `/viandera`, `/app`, `/admin` y un `/{slug}` real, confirmando cero
  errores de JS o de red en cada una.

- [ ] **Paso 9: Checklist final previo al despliegue**

  - [ ] Todos los pasos anteriores de esta tarea, en verde.
  - [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
        en verde sobre el estado final del branch.
  - [ ] `git diff --check main` sin salida.
  - [ ] `git status` limpio (nada sin commitear).
  - [ ] Confirmado con Codex que no hay findings abiertos de ninguna
        tarea anterior.

  Si algún ítem falla, no se avanza a integración/despliegue — se
  vuelve a la tarea de origen del defecto, se corrige ahí con su propio
  commit, y se repite este checklist completo.

Esta tarea no genera un commit propio — es el checkpoint final de QA
sobre lo ya commiteado en las Tasks 1 a 9. Si el Paso 7 obliga a un
ajuste, ese ajuste se commitea como una corrección con mensaje propio
sobre la tarea afectada (no acá), siguiendo el mismo patrón de commits
correctivos ya usado en las rondas de revisión anteriores de este mismo
proyecto.

**Punto de detención:** este plan queda completo cuando el checklist del
Paso 9 está en verde y Codex confirma el cierre de la ronda. La
integración a `main` y el despliegue **no** están incluidos en este plan
— son pasos separados que requieren autorización explícita del usuario,
igual que en el lanzamiento del explorador.

---

## Autorrevisión final

**Cobertura requisito por requisito contra la spec:**

| Requisito de la spec | Tarea que lo cubre |
|---|---|
| H1/bajada aprobados (sección 4.2) | Task 4 |
| Buscador reutilizado sin cambios (4.3) | Task 4 |
| Filtros rápidos con los 4 parámetros exactos (4.4) | Task 4 |
| Carrusel: 3–4 fotos, crossfade 500ms, autoplay 6s (5) | Tasks 1–3 |
| Botón persistente Pausar/Reanudar, hover/foco/touch temporal (5, WCAG 2.2.2) | Task 2 (lógica, incluida la secuencia táctil), Task 3 (UI) |
| `prefers-reduced-motion` sin autoplay inicial (5) | Task 2 (lógica), Task 3 (detección) |
| Semántica accesible del carrusel (5) | Task 3 |
| Imágenes locales, nunca URLs externas (5) | Task 1 |
| Imagen visible nunca se oculta antes de que la siguiente cargue; solo se precarga una por delante (5, 13) | Task 3, verificado con conexión lenta en Task 11 (Paso 3) |
| Fallback de marca ante imagen rota, sin intervalo vacío (5) | Task 3, verificado en Task 11 (Paso 3) |
| Franja de valor, 3 ítems aprobados (4.6) | Task 6 |
| "Descubrí qué hay para hoy", aclaración antes de la grilla (4.7) | Task 7 |
| Estados resultado/vacío/error diferenciados, error sin `/explorar` como garantía (7.1) | Task 7 |
| Cocinas fundadoras sin tocar el formulario (4.8) | Task 8 |
| Recorrido consumidor, 3 pasos (4.9) | Task 6 |
| Footer sin cambios funcionales (4.10) | Task 9 (no lo toca) |
| `MobileBottomNav` montado en `/` (4.11) | Task 9 |
| Header completo desde `lg`, nombres accesibles únicos (4.1) | Task 5 |
| `next/image`/`priority` exclusivo del carrusel, `DishCard` sin cambios (13) | Tasks 3, 7, 10 (Paso 5) |
| Lighthouse ≥90, LCP ≤2.5s, medición reproducible (13) | Task 11 (Paso 7, comando exacto sin `--preset`) |
| Responsive en los 6 anchos, con/sin sesión, zoom 200% (11, 12) | Task 11 |
| Sin analítica ni cambios de Supabase (Global Constraints) | Todas — confirmado explícitamente en Task 10 |
| Sin lead sintético en producción; escritura real requiere autorización (Global Constraints, seguridad de datos) | Task 11 (Paso 5) |

**Búsqueda de placeholders (corregido tras la revisión de Codex sobre
`9fa4aa9`):** revisado el documento completo — no queda ningún `TBD`,
`TODO`, "implementar después" ni instrucción sin código concreto. La
Task 1 ya no presenta el `CREDITOS.md` ni `carruselDatos.ts` como
tablas/objetos llenados con corchetes de ejemplo — presenta el esquema
requerido (columnas de la tabla, forma del campo `alt`) más una
instrucción exacta de qué valor real corresponde a cada uno, y un script
de verificación (Paso 6 de la Task 1) que falla explícitamente si
detecta corchetes `[...]`, el string literal `AAAA-MM-DD`, un `alt`
vacío, o menos de 4 `alt` distintos — el commit de esa tarea queda
bloqueado hasta que ese script imprima `OK`.

**Consistencia de firmas, tipos y nombres entre tareas:** `FotoCarrusel`
(Task 1) se usa sin modificación en Task 3 (`HeroCarousel`) y Task 4
(`PortadaHero`); `EstadoCarrusel`/`AccionCarrusel`/`reducirCarrusel`/
`estadoInicial`/`rotacionActiva`/`siguienteIndice`/`DURACION_ROTACION_MS`/
`DURACION_CROSSFADE_MS` (Task 2) se consumen sin renombrar en Task 3
(incluido el `siguienteIndice` que la corrección de precarga agregó a lo
que Task 3 importa); `FOTOS_CARRUSEL` (Task 1) se importa igual en
Task 4; los cuatro íconos nuevos de Task 3 (`IconFlechaIzquierda`,
`IconFlechaDerecha`, `IconPausa`, `IconReproducir`) no colisionan con
ningún nombre existente en `components/landing/icons.tsx`;
`ResultadoDestacados`/`clasificarDestacados` (Task 7) se usan sin
renombrar dentro de la misma tarea (`destacados.ts` → `destacados.test.ts`
→ `DescubriHoy.tsx`) y no se exportan hacia ninguna otra tarea. La firma
de `DescubriHoy` se declara explícitamente como
`async function DescubriHoy(): Promise<JSX.Element>` en Task 7 (antes
decía `(): JSX.Element` en la sección de Interfaces, inconsistente con
ser `async` — ya corregido ahí y no se repite ese error en ninguna otra
mención del componente en este documento).

**Confirmación de que ninguna tarea habilita analítica o cambios de
base:** ninguna de las 11 tareas importa `lib/analitica/eventos.ts`, usa
`createAdminClient()`, ni toca ningún archivo bajo `supabase/` —
confirmado explícitamente por el checklist de grep de la Task 10, Paso 4.
`lib/viandas/destacados.ts` (Task 7) no importa Supabase en absoluto: su
única dependencia con el mundo real es la función `buscar` que le pasa
`DescubriHoy.tsx`, inyectada desde afuera. Task 11, Paso 5 (corregido)
además prohíbe explícitamente insertar un lead sintético en el Supabase
de producción como parte de la verificación de este plan.

**`git diff --check`:**

```bash
git diff --check
```

Ejecutado sobre este plan (archivo Markdown único) — ver reporte final.
