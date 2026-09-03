# Portada comercial de ViandApp — Diseño

**Fecha:** 2026-09-03
**Estado:** Aprobado por el usuario y Codex — pendiente de plan de
implementación. Este documento es solo la especificación de diseño; no se
implementa hasta que exista un plan derivado y se apruebe explícitamente.
**Dirección visual:** "Manifiesto local + Mercado cercano"
**Referencia conceptual:** Gromuse, adaptada a ViandApp — inspiración de
estructura y densidad, no una copia literal de su composición, tipografía ni
ilustraciones.
**Contexto previo:** esta portada reemplaza visualmente la landing actual de
`/` (implementada en `app/(consumer)/page.tsx`, ver
[2026-09-03-explorador-consumidores-design.md](2026-09-03-explorador-consumidores-design.md)
para el sistema visual y las consultas que ya existen para `/explorar` y
`/{slug}`, reutilizados acá).

## Resumen

Hoy `/` es una landing orientada 100% a captar cocinas ("vianderas") — una
persona que busca comida no tiene ningún motivo para visitarla. Esta
portada da vuelta esa prioridad: la primera pantalla, el mensaje principal y
el recorrido guiado son para quien quiere **pedir** una vianda hoy; captar
cocinas nuevas pasa a ser la audiencia secundaria, con su propio espacio más
abajo en la misma página, sin perder el formulario ni los datos que ya junta.

`/explorar` y `/{slug}` no cambian en esta entrega — ya están lanzados y
verificados en producción. Esta spec cubre exclusivamente el rediseño de
`/`.

## 1. Objetivo y métricas de éxito

**Objetivo:** que una persona de Rafaela que entra a `viandapp.ar` entienda
en menos de 5 segundos qué es ViandApp, encuentre un motivo concreto para
tocar "Buscar" o un filtro rápido, y llegue a `/explorar` con intención real
de pedir. Que una cocina que todavía no se sumó encuentre su propio llamado
a la acción sin que compita visualmente con el mensaje principal.

**Métricas de éxito (cuando la analítica se conecte — Task 9, hoy pausada):**
Esta entrega no agrega eventos nuevos ni instrumenta nada — reutiliza los 7
eventos ya definidos en `lib/analitica/eventos.ts`. Cuando esa
instrumentación se conecte, el éxito de esta portada se puede leer con los
eventos que ya existen, sin cambios:

- Tasa de clics desde `/` hacia `/explorar` (buscador, filtros rápidos,
  tarjetas de "Descubrí qué hay para hoy") — se infiere hoy indirectamente
  vía `explore_viewed` una vez conectado, no hay evento propio de "clic en
  la portada".
- Envíos del formulario de cocinas fundadoras — ya medible por el conteo de
  filas en `interesados_viandera`, sin necesitar analítica.

**Validación mientras la analítica sigue pausada:** éxito de esta entrega se
juzga de forma cualitativa (revisión visual y funcional en los cinco anchos
de la sección 11, ver también la sección "Plan de validación visual y
funcional" al final) y por observación directa de si el formulario sigue
recibiendo interesados y si `/explorar` sigue recibiendo tráfico desde `/`.
No se introduce ningún evento, tabla ni columna nueva de analítica en esta
entrega — ver Global Constraints.

## 2. Audiencias

1. **Principal — consumidores de Rafaela** que quieren resolver una comida
   hoy. La portada les habla primero, en el tono de "acá hay comida casera
   real, cerca tuyo, mirá el menú y listo".
2. **Secundaria — cocinas que quieran sumarse al piloto.** Siguen teniendo
   un espacio claro y accesible (sección 4.8), con el mismo formulario que ya
   funciona hoy, pero ya no abre la página ni domina el primer scroll.

## 3. Sistema visual

Reutiliza sin cambios la paleta y tipografía ya definidas en
`tailwind.config.ts` y documentadas en
[2026-09-03-explorador-consumidores-design.md](2026-09-03-explorador-consumidores-design.md#3-sistema-visual-aprobado).
Esta spec no agrega tokens nuevos.

| Token | Hex | Uso en esta portada |
|---|---:|---|
| `paper` | `#FBF2E4` | Fondo general de la página fuera del hero |
| `card` | `#FFFCF6` | Tarjetas de plato, tarjeta del formulario |
| `ink` | `#362417` | Texto principal sobre `paper`/`card` |
| `ink-muted` | `#716255` | Texto secundario |
| `coral` (marca, `#D85A30`) | | Marca, CTA secundarios, acentos |
| `coral-600` (= `coral-action`) | `#B84826` | Texto blanco pequeño sobre coral (botones) |
| `teal` (`#1F6F6B`) | | Fondo del hero, acentos de confianza |
| `soft-teal` | `#EAF4F3` | Fondo de la franja de valor |
| `mostaza` (`#E8A93D`) | | Acento terciario — badge "Cocina fundadora" en la sección 4.8, con moderación |

**Tipografía:** Baloo 2 (`font-display`) para el H1, kicker y números de la
sección de recorrido; Inter (`font-sans`) para todo el resto — buscador,
filtros, tarjetas, formulario, footer. Ninguna tipografía nueva.

**Hero sobre `teal`:** es la única sección de esta portada con fondo oscuro
(`bg-teal`). Todo texto y control dentro del hero usa `text-white` o
`text-white/80` para texto secundario — nunca `ink` sobre `teal` (falla
contraste). El buscador (`GlobalSearch`) y los filtros rápidos usan sus
mismas superficies claras (`bg-card`) flotando sobre el fondo teal, igual
que ya hacen las tarjetas dentro de secciones con fondo `card/60` en la
landing actual — no hace falta una variante de color nueva de esos
componentes.

## 4. Jerarquía y copy

Estructura de arriba hacia abajo. El copy marcado **(aprobado)** es literal
y no se reemplaza sin nueva aprobación explícita; el resto es copy
propuesto, ajustable en implementación siempre que respete el tono
cercano/local de `CLAUDE.md`.

### 4.1 Header (global, `components/layout/Header.tsx`)

Este componente es compartido por **todas** las rutas (`app/layout.tsx` lo
renderiza siempre), no solo `/`. Este rediseño lo toca porque agrega dos
enlaces nuevos:

- Logo (sin cambios).
- **Explorar** → `/explorar`.
- **Cómo funciona** → `/#como-funciona` (ancla dentro de esta portada; ver
  sección 4.9). Igual que el fix ya aplicado a "Sumarte como viandera"
  (`/#sumate`, absoluto), esta ancla debe ser absoluta para funcionar desde
  cualquier ruta, no solo desde `/`.
- **Sumar mi cocina** → `/#sumate` (mismo destino y mismo enlace que hoy
  usa el texto "Sumarte como viandera"; esta entrega solo le cambia el
  texto visible, no el destino).
- **Ingresar** / **Mi cuenta** → sin cambios (mismo condicional por sesión
  que ya existe).

**Responsive:** en `sm` y superior se muestran los cuatro enlaces
intermedios (Explorar, Cómo funciona, Sumar mi cocina) igual que hoy se
muestra "Sumarte como viandera" (`hidden ... sm:block`). Por debajo de
`sm`, el header muestra solo logo + Ingresar/Mi cuenta, igual que hoy — el
acceso mobile a Explorar y a Sumar mi cocina lo cubre la navegación
inferior (sección 4.11), y "Cómo funciona" es una sección de la misma
página `/`, alcanzable haciendo scroll. Esta decisión evita amontonar
cuatro enlaces de texto en un header de 320 px de ancho.

Como el Header es global, este cambio se verifica visualmente en **todas**
las rutas existentes (`/`, `/explorar`, `/login`, `/registro`, `/viandera`,
`/app`, `/admin`, `/{slug}`), no solo en la portada — ver Criterios de
aceptación y Plan de validación.

### 4.2 Hero (`teal`, consumidor-first)

- Kicker (Baloo 2, uppercase, `text-white/70`): "Rafaela, Santa Fe".
- H1 (Baloo 2) **(aprobado):** "Hoy no cocines. Elegí casero."
- Bajada (Inter, `text-white/85`) **(aprobado):** "Encontrá viandas
  preparadas por cocinas de Rafaela. Mirá el menú y coordiná directo por
  WhatsApp."
- Buscador (sección 4.3) y filtros rápidos (sección 4.4), en ese orden,
  debajo de la bajada.
- Carrusel fotográfico (sección 5) como **panel separado**, nunca como
  fondo pleno detrás del texto: en desktop, layout de dos columnas (texto
  fijo a la izquierda, panel del carrusel a la derecha, con el radio de
  tarjeta ya usado en el resto del sitio); en mobile, el panel del
  carrusel va apilado debajo del texto fijo, a todo el ancho. Como el
  texto y la foto nunca se superponen, no hace falta ningún velo/overlay
  para sostener el contraste — el contraste del texto se resuelve
  íntegramente por estar siempre sobre `bg-teal` sólido, nunca sobre una
  fotografía.

### 4.3 Buscador

Reutiliza `components/consumer/GlobalSearch.tsx` sin cambios de
comportamiento: `action="/explorar"`, `method="GET"`, campo `q`. En el hero
se usa con `initialQuery=""` y sin `filtrosActuales` (no hay filtros activos
en la portada). No se crea una variante nueva del componente.

### 4.4 Filtros rápidos

Cuatro accesos directos a `/explorar` con un filtro predefinido:
**Almuerzo**, **Cena**, **Retiro**, **Envío**. Son enlaces (`<Link>`), no
controles interactivos con estado — construidos igual que
`construirHref` de `components/consumer/FilterChips.tsx` pero sin el
concepto de "activo" (en la portada ningún filtro está seleccionado
todavía) y sin las etiquetas dietarias ni el botón "Limpiar todo", que no
aplican acá:

| Filtro | Destino |
|---|---|
| Almuerzo | `/explorar?tipo=almuerzo` |
| Cena | `/explorar?tipo=cena` |
| Retiro | `/explorar?modalidad=retiro` |
| Envío | `/explorar?modalidad=envio` |

Estos cuatro valores (`almuerzo`, `cena`, `retiro`, `envio`) son
exactamente los que ya valida `parsearFiltros` en `lib/viandas/filtros.ts`
— este componente nuevo solo arma el enlace, nunca valida ni interpreta el
filtro. Ningún componente de esta portada reimplementa esa lógica (ver
Global Constraints).

Presentación: fila de píldoras horizontal, scroll horizontal en mobile si
no entran las cuatro (mismo patrón `overflow-x-auto` que ya usa
`FilterChips`), sin wrap que rompa la fila en dos líneas en mobile.

### 4.5 Carrusel

Ver especificación completa en la sección 5. Dentro de la jerarquía: es
exclusivamente fotográfico — no lleva su propio título, texto ni CTA; el
título, la bajada, el buscador y los filtros rápidos del hero permanecen
fijos mientras el carrusel rota.

### 4.6 Franja de valor

Tira de tres ítems, sin numeración (no es una secuencia — ver la regla de
`CLAUDE.md` sobre no agregar numeración decorativa fuera de procesos
reales), cada uno con ícono + texto corto **(aprobado, los tres textos)**:

| Ícono | Texto |
|---|---|
| `IconPlato` (ya existe en `components/landing/icons.tsx`) | Directo a la cocina |
| `IconMoneda` (ya existe) | Sin comisiones |
| `IconPin` (ya existe) | Hecho en Rafaela |

No se necesita ningún ícono nuevo — los tres ya existen y ya se usan en la
landing actual (sección "¿Por qué sumarte?"), con un significado compatible.

Fondo: `bg-soft-teal` sobre `paper` — el hero inmediatamente encima ya usa
`teal` sólido; repetir el mismo bloque de color dos veces seguidas se ve
templated, y `soft-teal` mantiene la asociación cromática con el hero sin
duplicarlo.

### 4.7 "Descubrí qué hay para hoy"

Sección alimentada **únicamente** con datos reales — nunca con platos,
precios o cocinas inventadas. Ver especificación completa de datos y
estados en la sección 7.

Título **(aprobado):** "Descubrí qué hay para hoy". Este título es copy de
marketing, no una promesa de disponibilidad diaria: el modelo de datos
actual no representa días ni horarios (misma restricción ya documentada en
el spec de `/explorar`, sección "Global Constraints" — "No usar 'Disponible
hoy'"). Para no contradecir esa restricción mientras se mantiene el título
aprobado, esta sección lleva una aclaración chica debajo de la grilla:
"Los menús pueden cambiar — confirmá disponibilidad por WhatsApp antes de
coordinar." Ninguna tarjeta de esta sección afirma "disponible hoy" ni
usa lenguaje de horario; el título es el único lugar donde aparece la
palabra "hoy", como gancho editorial, no como dato.

Grilla de hasta 8 tarjetas (`DishCard`, reutilizado sin cambios de
`components/consumer/DishCard.tsx`), cada una linkeando a `/{slug}` de su
viandera — mismo comportamiento que en `/explorar`.

### 4.8 Cocinas fundadoras

Reemplaza in situ las secciones "¿De qué se trata?", "¿Cómo funciona?" (la
de 3 pasos para vianderas) y "¿Por qué sumarte?" de la landing actual,
consolidándolas en una sola sección más corta — la portada ya no necesita
convencer con tres bloques separados porque ya no es la puerta de entrada
principal para cocinas. Contenido:

- Título propuesto: "¿Cocinás? Sé de las primeras en aparecer en
  ViandApp."
- Texto breve reutilizando la idea ya validada de la landing actual (sin
  comisiones, sin depender de apps de delivery ni de publicar a mano en
  grupos de WhatsApp).
- Badge opcional "Cocina fundadora" (`mostaza`, con moderación, un único
  uso en toda la página) para enmarcar el beneficio de sumarse temprano.
- El formulario existente (`components/landing/FormularioInteres.tsx`,
  acción `anotarseComoInteresada` en `app/(consumer)/actions.ts`, tabla
  `interesados_viandera`) se mantiene **sin ningún cambio funcional** —
  mismos campos, misma validación, mismo Server Action. Solo puede
  cambiar el contenedor visual alrededor (título, texto de la sección),
  nunca el formulario en sí.
- El `id="sumate"` se mantiene igual (ya lo usan `Header` y `Footer` con el
  enlace `/#sumate`) para no romper esos enlaces existentes.

### 4.9 Recorrido explorar → perfil → WhatsApp

Secuencia real de 3 pasos — sí lleva numeración, siguiendo la misma
convención que la actual "¿Cómo funciona?" de vianderas (números válidos
porque es un proceso real, no decorativo):

1. **Explorá** — Buscá por nombre de plato o filtrá por almuerzo, cena,
   retiro o envío.
2. **Elegí tu plato** — Mirá el menú completo de cada cocina: fotos,
   precios y etiquetas dietarias.
3. **Coordiná por WhatsApp** — Confirmás disponibilidad y entrega directo
   con la cocina, sin intermediarios.

Ancla `id="como-funciona"` — es el destino del enlace "Cómo funciona" del
header (sección 4.1).

### 4.10 Footer

Reutiliza `components/layout/Footer.tsx` sin cambios funcionales — mismo
copyright, mismo crédito a JuanoConecta, mismo enlace `/#sumate`. Solo
admite ajustes visuales menores (espaciado, color) si hacen falta para que
combine con el resto de la portada; el contenido y los enlaces no cambian.

### 4.11 Navegación inferior en mobile

`components/consumer/MobileBottomNav.tsx` se reutiliza **sin cambios** —
mismos tres ítems (Inicio, Explorar, Sumar mi cocina), mismo componente. Se
monta en `/` para `< lg` (igual que ya se monta en `/explorar`), sin
agregar `DesktopSidebar` a la portada — la portada no tiene sidebar en
ningún ancho, esa navegación es exclusiva de `/explorar`. El padding
inferior del `body` que reserva espacio para esta barra
(`body:has([data-consumer-bottom-nav])`, ya definido en `app/globals.css`)
se activa automáticamente al montar este componente, sin necesitar
ningún cambio de CSS.

## 5. Carrusel

Componente Client Component chico y aislado (única parte interactiva de
esta portada que necesita ejecutarse en el navegador).

- **3 a 4 fotografías.**
- **Rotación automática cada 6 segundos.**
- **Transición:** crossfade de aproximadamente 500 ms entre imágenes.
- **Controles:** flechas (anterior/siguiente), indicadores (uno por
  imagen, clicables) y gesto de swipe en touch.
- **Pausa:** al pasar el mouse por encima, al recibir foco de teclado
  dentro del carrusel, o mientras el usuario interactúa con flechas o
  indicadores. Se reanuda la rotación automática al perder el hover/foco.
- **`prefers-reduced-motion: reduce`:** sin rotación automática; se muestra
  la primera imagen de forma estática. Flechas e indicadores siguen
  operables manualmente (el usuario puede seguir cambiando de imagen a
  pedido, solo se elimina el movimiento automático/no solicitado).
- **Teclado:** flechas del carrusel son botones enfocables y accionables
  con Enter/Espacio; los indicadores también. Foco visible en todos.
- **Alt text:** cada imagen lleva `alt` descriptivo del contenido real de
  la foto (ej. "Milanesa napolitana con puré de papas servida en un
  contenedor de vianda"), nunca `alt=""` — las fotos son contenido
  informativo, no decorativo.

**Contenido de las fotografías — regla central de honestidad:**

- Ninguna fotografía del carrusel puede mostrar overlays con precios,
  disponibilidad, botones falsos ni nombres de cocinas inventadas
  superpuestos a la imagen.
- Mientras una fotografía sea ilustrativa (no corresponde a un plato
  publicado hoy en la base de datos), debe presentarse como tal: una
  leyenda visible junto a la imagen o en el pie del carrusel indicando
  "Imagen ilustrativa" (o equivalente), y esa imagen **no** lleva enlace a
  ningún perfil.
- Cuando exista un plato real y disponible adecuado para mostrar en el
  carrusel (foto de calidad suficiente, cargada por una viandera activa),
  esa imagen puede enlazar a `/{slug}` de esa viandera — en ese caso no
  lleva la leyenda "Imagen ilustrativa", porque deja de serlo.
- La selección de qué fotografías usar (ilustrativas de stock/encargadas
  vs. reales) y la carga de los archivos finales es una decisión de
  implementación posterior a esta spec, no algo que esta spec resuelva —
  ver Fuera de alcance.

## 6. Componentes

```text
components/
  landing/
    PortadaHero            (nuevo — Server Component: kicker, H1, bajada;
                             envuelve GlobalSearch, HeroQuickFilters y
                             HeroCarousel — secciones 4.2 a 4.5)
    HeroCarousel            (nuevo — Client Component, único fragmento
                             interactivo de la portada — sección 5)
    HeroQuickFilters        (nuevo — Server Component, los 4 enlaces de
                             la sección 4.4)
    FranjaValor             (nuevo — Server Component, los 3 ítems de la
                             sección 4.6)
    DescubriHoy             (nuevo — Server Component async, envuelve
                             `buscarPlatos` dentro de un límite Suspense
                             — sección 4.7 / 7.1)
    CocinasFundadoras       (nuevo — Server Component, envuelve el
                             `FormularioInteres` existente sin tocarlo —
                             sección 4.8)
    RecorridoConsumidor     (nuevo — Server Component, los 3 pasos
                             numerados de la sección 4.9)
    FormularioInteres       (existente — sin cambios funcionales)
    icons.tsx                (existente — se reutilizan `IconPlato`,
                             `IconMoneda`, `IconPin`; no se agregan
                             íconos nuevos)
  consumer/
    GlobalSearch             (existente — se reutiliza tal cual dentro
                             de `PortadaHero`)
    DishCard                 (existente — se reutiliza tal cual dentro
                             de `DescubriHoy`)
    ResultsSkeleton           (existente — se reutiliza tal cual o con
                             el conteo recortado a 8, como `fallback`
                             del Suspense de `DescubriHoy`)
    MobileBottomNav           (existente — se reutiliza sin cambios,
                             ahora también montado en `/` — sección 4.11)
  layout/
    Header                    (existente — modificado in place: agrega
                             los enlaces Explorar y Cómo funciona —
                             sección 4.1)
    Footer                    (existente — sin cambios funcionales,
                             solo ajustes visuales menores — sección 4.10)
```

`DesktopSidebar` no se usa en esta portada (queda exclusivo de
`/explorar`, ver sección 4.11). `app/(consumer)/page.tsx` se reescribe in
place para componer los bloques nuevos de arriba; no se crea ninguna ruta
ni ningún archivo nuevo bajo `app/`.

## 7. Datos y estados

### 7.1 "Descubrí qué hay para hoy"

Reutiliza `buscarPlatos` de `lib/viandas/consultas.ts` **sin modificarla**
— se la llama con filtros vacíos (`{ q: "", tipo: "todos", etiqueta: null,
modalidad: "todas" }`, el mismo shape `FiltrosExplorador` que ya usa
`/explorar`) y se toman los primeros 8 resultados (la función ya ordena por
`created_at` descendente y limita a 48 — la portada solo recorta esa lista,
no cambia el orden ni el límite de la consulta). No se crea una consulta
nueva ni se duplica lógica de filtros — ver Arquitectura, sección 10.

**Decisión de manejo de errores, distinta de `/explorar`:** en
`app/explorar/page.tsx`, un error real de `buscarPlatos` se deja propagar
a propósito hasta `app/explorar/error.tsx`, porque en esa ruta la búsqueda
*es* la página completa. En la portada esta consulta alimenta una sola
sección entre muchas (hero, franja de valor, formulario de cocinas), y
`app/(consumer)/` no tiene hoy un `error.tsx` propio — dejar que el error
se propague ahí rompería toda la portada, incluido el hero y el formulario
de captación, por el fallo de una sección secundaria. Por eso esta sección
sí atrapa el error localmente (`try/catch` alrededor de la llamada, dentro
del Server Component async que resuelve solo esta sección) y muestra un
estado de error acotado a la sección, sin afectar el resto de la página.

Estados:

- **Con resultados (1 a 8 platos):** grilla de `DishCard`.
- **Sin resultados (`buscarPlatos` resuelve `[]`):** no se oculta la
  sección ni se deja vacía — se reemplaza el contenido por una invitación
  al piloto, ej.: "Todavía estamos sumando las primeras cocinas de
  Rafaela. ¿Cocinás vos? Sumate más abajo." con un enlace a `/#sumate`.
  Nunca se rellena con platos, precios o cocinas ficticias para evitar el
  estado vacío.
- **Error de consulta (excepción atrapada):** mensaje distinto del estado
  vacío — ej.: "No pudimos cargar los platos disponibles ahora mismo.
  Mirá el menú completo en /explorar." con enlace a `/explorar`. No debe
  poder confundirse con "no hay platos cargados": un fallo técnico no es
  lo mismo que un catálogo vacío.
- **Carga:** esta sección se resuelve en un Server Component separado
  (`DescubriHoy`, sección 6) dentro de un límite `<Suspense>` (para no
  bloquear el LCP del hero, que no depende de esta consulta) con
  `fallback` a un esqueleto — se reutiliza `components/consumer/
  ResultsSkeleton.tsx` tal cual, o una variante recortada a 8 tarjetas en
  vez de 6 si hace falta ajustar el conteo (decisión menor de
  implementación, sin impacto de diseño).

### 7.2 Formulario de cocinas fundadoras

Mismos estados que ya implementa `FormularioInteres.tsx` hoy
(`idle`/`ok`/`error` vía `useActionState`) — esta spec no le agrega ni le
quita ningún estado. Sigue funcionando exactamente igual, solo cambia lo
que lo rodea visualmente.

### 7.3 Carrusel

- Si por algún motivo ninguna imagen carga (falla de red, archivo
  faltante), el carrusel no debe dejar un hueco en blanco que rompa el
  layout del hero: reserva su espacio con dimensiones fijas (ver medidas,
  sección 8) independientemente de si la imagen cargó, evitando salto de
  layout (CLS).

## 8. Medidas de recursos

| Uso | Medida | Relación de aspecto |
|---|---:|---|
| Maestro (archivo fuente) | 2400 × 1600 px | 3:2 |
| Hero — desktop | 1600 × 1100 px | ~16:11 |
| Hero — mobile | 900 × 1200 px | 3:4 |
| Tarjetas (carrusel recortado a tarjeta / uso secundario) | 1200 × 900 px | 4:3 |
| Social (opcional) | 1080 × 1080 px | 1:1 |

- **Formato:** WebP o AVIF (no JPEG/PNG como entrega final).
- **Peso objetivo:** ≤250 KB por imagen en desktop, ≤160 KB en mobile
  (servidas mediante `next/image` con los tamaños responsive que
  correspondan a cada breakpoint, no la misma imagen de 2400 px en
  mobile).
- **Foco principal:** centrado en el encuadre maestro, con espacio
  suficiente alrededor del sujeto principal para que el recorte a
  cualquiera de las medidas de arriba no corte cabezas, platos o texto
  relevante de la foto.
- Nota de aspecto: el recorte de hero mobile (3:4, vertical) es
  sustancialmente distinto del hero desktop (~16:11, horizontal) — el
  maestro 3:2 debe dejar margen suficiente en ambos ejes para que ambos
  recortes funcionen sin recomponer la foto a mano por imagen.

## 9. Estados honestos (resumen transversal)

Esta regla atraviesa toda la portada, no solo la sección 7:

- Nunca se renderizan platos, precios, cocinas o testimonios ficticios
  presentados como reales, en ninguna sección.
- Toda fotografía ilustrativa se identifica como tal (sección 5).
- Un error de consulta siempre se distingue visualmente de "no hay
  resultados todavía" (sección 7.1).
- El formulario de interesados sigue operativo y es el único mecanismo de
  captación de cocinas — no se agregan textos que prometan funcionalidad
  que no existe (ej. "publicá tu menú en 2 minutos" cuando el alta real
  pasa por invitación desde `/admin`, no autoservicio).

## 10. Arquitectura

- **Reutiliza `buscarPlatos`** (`lib/viandas/consultas.ts`) para los
  platos destacados — no se crea una consulta paralela ni se le agregan
  parámetros nuevos. La portada solo decide cuántos resultados mostrar
  (8) sobre la lista que la función ya devuelve.
- **No duplica lógica de filtros:** los filtros rápidos (sección 4.4) son
  enlaces que arman querystrings con los mismos nombres/valores que ya
  valida `parsearFiltros` — ningún componente nuevo reimplementa esa
  validación.
- **No conecta la analítica pausada.** Ningún componente de esta portada
  llama a `lib/analitica/eventos.ts` ni a ninguna función que escriba en
  `eventos_analitica`. Sigue exactamente como quedó en la Task 9 diferida.
- **No modifica Supabase.** Ni schema, ni RLS, ni policies, ni datos. Todo
  el contenido de esta portada sale de tablas y columnas que ya existen
  (`vianderas`, `viandas`, `interesados_viandera`).
- **Server Components por defecto.** Header, hero (contenido fijo),
  filtros rápidos, franja de valor, sección de platos destacados, sección
  de cocinas fundadoras, recorrido y footer son Server Components. Solo
  el carrusel es Client Component (necesita estado de índice actual,
  temporizador y listeners de teclado/hover/swipe).
- **El carrusel queda aislado** en su propio archivo Client Component
  (`components/landing/HeroCarousel.tsx`, ver sección 6), sin arrastrar el
  resto del hero a `"use client"` — el H1, la bajada, el buscador y los
  filtros rápidos siguen siendo Server Components renderizados alrededor
  de ese componente aislado.
- **No rompe rutas existentes.** `/explorar`, `/{slug}`, `/login`,
  `/registro`, `/viandera`, `/app`, `/admin` y el formulario de
  interesados siguen funcionando igual. El único componente compartido
  que esta portada modifica es `Header.tsx` (agrega dos enlaces); ningún
  otro archivo fuera de `app/(consumer)/page.tsx` y los componentes nuevos
  bajo `components/landing/` necesita cambios.
- **No se agregan rutas nuevas** — esta entrega rediseña `/` in place, no
  crea una ruta paralela. No hace falta tocar `RUTAS_RESERVADAS` en
  `lib/viandera/slug.ts`.
- Se mantiene la restricción ya vigente en `CLAUDE.md`: no envolver el
  `<form action={anotarseComoInteresada}>` con `AnimatePresence
  mode="wait"` ni `motion.form` — si la sección de cocinas fundadoras
  lleva animación de entrada, se aplica con `initial`/`animate` sin
  `exit`, dejando que React reemplace el `<form>` nativo directo entre el
  estado `idle` y `ok`, igual que ya resuelve `FormularioInteres.tsx` hoy.

## 11. Responsive

Mobile-first, verificado explícitamente en: **320, 375, 768, 1024 y
1440 px** de ancho.

- Sin scroll horizontal accidental en ningún ancho de esa lista.
- Objetivos táctiles de al menos 44 × 44 px en todo elemento clickeable:
  botones del buscador, filtros rápidos, flechas/indicadores del
  carrusel, enlaces del header, ítems de la navegación inferior, campos y
  botón del formulario.
- Hero: apilado (texto fijo arriba, panel del carrusel abajo) en mobile;
  dos columnas (texto fijo a la izquierda, panel del carrusel a la
  derecha) en desktop — ver decisión de layout fija en la sección 4.2, sin
  variantes de fondo pleno.
- Ancho máximo de contenido en desktop: 1440 px, igual que ya define el
  spec de `/explorar` para `ConsumerShell`.
- La navegación inferior mobile (sección 4.11) se oculta en `lg` y
  superior, igual que hoy.

## 12. Accesibilidad

Cumplimiento mínimo WCAG 2.2 AA, igual que el resto del producto:

- Contraste mínimo 4.5:1 para texto normal, incluido el texto blanco
  sobre el hero `teal` (el texto del hero nunca se superpone a una
  fotografía — ver sección 4.2 — así que su contraste depende solo de ese
  fondo sólido).
- Foco visible de 2–3 px en todo control interactivo (enlaces del header,
  buscador, filtros rápidos, carrusel, formulario), consistente con el
  resto del sitio (`focus-visible:outline` ya usado en todos los
  componentes existentes).
- Carrusel operable completamente por teclado (flechas e indicadores como
  elementos enfocables y accionables — ver sección 5).
- Pausa accesible del contenido automático: el carrusel se detiene ante
  hover, foco de teclado o interacción manual, y no rota en absoluto bajo
  `prefers-reduced-motion: reduce` — cumple el criterio WCAG 2.2.2
  (Pausar, Detener, Ocultar) sin necesitar un botón de pausa dedicado,
  porque el foco/hover ya lo cubre y el usuario puede quedarse
  indefinidamente sobre el carrusel si lo desea.
- Sin movimiento obligatorio: ninguna animación de esta portada (entrada
  de secciones, crossfade del carrusel) es indispensable para entender o
  usar el contenido; todas respetan `prefers-reduced-motion`.
- Zoom de texto al 200% sin pérdida de contenido ni superposición rota
  (verificar especialmente el hero: el panel del carrusel y el bloque de
  texto son elementos separados que deben poder reflowear a apilado si
  hace falta, sin recortar ni tapar el texto).
- Imágenes con `alt` descriptivo (fotos del carrusel y de las tarjetas de
  platos) o `alt=""` solo cuando sean puramente decorativas — ninguna
  imagen de esta portada lo es, todas son contenido.
- Landmarks: el header sigue siendo el único `<header>`, el footer el
  único `<footer>`, y `app/layout.tsx` sigue proveyendo el único
  `<main>` — igual que ya establece `ConsumerShell` para `/explorar`, esta
  portada no anida un segundo `<main>`.

## 13. Rendimiento y SEO

- **LCP:** el elemento más grande del primer viewport es previsiblemente
  la imagen del panel del carrusel o el bloque de texto del hero —
  cualquiera sea, la primera imagen del carrusel se sirve sin
  lazy-loading (`priority` en `next/image` o equivalente) para no
  penalizar el LCP; las imágenes 2ª a 4ª sí pueden cargar en diferido.
- La sección "Descubrí qué hay para hoy" se resuelve en un límite
  `<Suspense>` separado (sección 7.1) precisamente para que su consulta a
  Supabase no bloquee el render ni el LCP del hero, que no depende de
  ella.
- Todas las imágenes usan `next/image` con los tamaños responsive de la
  sección 8, nunca la imagen maestra de 2400 px servida tal cual en
  mobile.
- **Metadata:** `app/(consumer)/page.tsx` puede exportar su propio
  `metadata` (Next.js permite sobrescribir el de `app/layout.tsx` a nivel
  de página) con un título y descripción alineados al nuevo mensaje
  principal — propuesta: título "ViandApp — Viandas caseras en Rafaela,
  directo por WhatsApp" y descripción basada en la bajada aprobada de la
  sección 4.2. El `metadataBase` (`https://viandapp.ar`) definido en
  `app/layout.tsx` no cambia.

## 14. Criterios de aceptación

- El H1 y la bajada del hero coinciden textualmente con el copy aprobado
  de la sección 4.2.
- El buscador del hero envía a `/explorar` con el término ingresado en
  `q`, igual que el buscador ya existente en `/explorar`.
- Los cuatro filtros rápidos navegan a `/explorar` con exactamente los
  parámetros de la tabla de la sección 4.4, y esos parámetros son
  interpretados correctamente por `parsearFiltros` sin cambios en esa
  función.
- El carrusel cumple los ocho puntos de comportamiento de la sección 5
  (rotación, crossfade, controles, pausa, `prefers-reduced-motion`, alt
  text, sin overlays de precio/negocio inventado, leyenda en imágenes
  ilustrativas).
- La sección "Descubrí qué hay para hoy" nunca muestra un plato, precio o
  cocina que no exista realmente en la base — sus tres estados (con
  resultados / vacío / error) son visualmente distinguibles entre sí.
- El formulario de cocinas fundadoras sigue insertando filas reales en
  `interesados_viandera` sin ningún cambio de comportamiento respecto de
  hoy.
- El header (global) muestra Explorar, Cómo funciona y Sumar mi cocina en
  `sm` y superior, y no rompe visualmente ninguna otra ruta del sitio.
- La navegación inferior mobile aparece en `/` para `< lg`, con los
  mismos tres ítems que ya usa `/explorar`.
- Sin scroll horizontal accidental ni objetivos táctiles menores a
  44 × 44 px en 320, 375, 768, 1024 y 1440 px.
- Contraste AA en todo texto, incluido el texto sobre el hero `teal`.
- Zoom de texto al 200% sin pérdida ni superposición de contenido.
- `/explorar`, `/{slug}`, `/login`, `/registro`, `/viandera`, `/app` y
  `/admin` siguen funcionando exactamente igual que antes de este cambio.
- No se agrega ninguna llamada a `lib/analitica/eventos.ts` ni ninguna
  escritura nueva en `eventos_analitica`.
- No hay ningún cambio en el schema, RLS, policies o datos de Supabase.

## 15. Fuera de alcance

- **Selección y carga de las fotografías finales** del carrusel (stock,
  encargadas o reales) — esta spec define formato, medidas, peso y reglas
  de honestidad, no el banco de imágenes concreto. Se resuelve en la
  etapa de implementación o en una tarea previa de preparación de
  contenido.
- **Conectar la analítica** (Task 9, ya diferida) — esta portada no la
  activa ni la modifica.
- **Rediseño de `/explorar` o `/{slug}`** — ya lanzados, sin cambios en
  esta entrega.
- **Mapa, geolocalización, carrito, checkout, pagos, favoritos o cuentas
  de consumidor** — mismas exclusiones ya vigentes para todo el
  explorador (ver spec de `/explorar`, "Siguiente entrega").
- **Sistema de "cocina fundadora" con beneficios reales** (badge
  permanente en su perfil, prioridad de listado, etc.) — el badge de la
  sección 4.8 es solo copy de esta portada, no implica ningún cambio de
  datos o de comportamiento en `/{slug}` ni en el panel de viandera.
- **Rediseño del panel `/admin` o `/viandera`** — sin cambios.
- **A/B testing del mensaje principal** — el copy de la sección 4.2 es la
  única versión aprobada para esta entrega.

## Plan de validación visual y funcional

Antes de dar por aprobada la implementación (cuando exista):

1. **Cinco anchos:** 320, 375, 768, 1024 y 1440 px — capturar cada sección
   de la portada, confirmar ausencia de scroll horizontal y de objetivos
   táctiles menores a 44 px.
2. **Carrusel:** verificar rotación de 6 s, crossfade, flechas,
   indicadores y swipe en un ancho mobile real (no solo emulado);
   confirmar pausa con hover y con foco de teclado; confirmar que con
   `prefers-reduced-motion: reduce` no rota automáticamente y la primera
   imagen es estática; confirmar que ninguna imagen lleva overlay de
   precio/negocio inventado.
3. **Recorrido de datos reales:** con las 1–2 vianderas y los 2 platos que
   ya existen en el Supabase real (o los que existan al momento de
   implementar), confirmar que "Descubrí qué hay para hoy" los muestra
   correctamente enlazando a su `/{slug}`.
4. **Estado vacío:** simular (en un entorno de prueba, no en producción)
   que `buscarPlatos` devuelve `[]` y confirmar que aparece la invitación
   al piloto, no una grilla vacía ni platos inventados.
5. **Estado de error:** simular un fallo de la consulta y confirmar que el
   mensaje de error es visualmente distinto del estado vacío, y que el
   resto de la portada (hero, formulario) sigue funcionando con
   normalidad.
6. **Formulario:** confirmar que sigue insertando en `interesados_viandera`
   sin cambios de comportamiento (mismos tres estados `idle`/`ok`/`error`).
7. **Header en todas las rutas:** navegar `/`, `/explorar`, `/login`,
   `/registro`, `/viandera`, `/app`, `/admin` y un `/{slug}` real,
   confirmando que el header nuevo no rompe ninguna de esas páginas y que
   "Cómo funciona" resuelve a `/#como-funciona` correctamente desde una
   ruta distinta de `/`.
8. **Accesibilidad:** navegación completa por teclado del header, buscador,
   filtros rápidos, carrusel y formulario; verificación de contraste AA
   con una herramienta automática sobre el hero `teal`; zoom de texto al
   200%.
9. **Lighthouse / Core Web Vitals:** confirmar que el LCP no empeora
   respecto de la landing actual pese al carrusel — particular atención a
   que la primera imagen use `priority` y a que la sección de platos
   destacados esté detrás de `Suspense`.
10. **Consola limpia:** sin errores de JS ni de red en ninguna de las
    rutas visitadas en el punto 7.
