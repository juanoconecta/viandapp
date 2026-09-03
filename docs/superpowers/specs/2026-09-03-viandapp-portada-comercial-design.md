# Portada comercial de ViandApp — Diseño

**Fecha:** 2026-09-03
**Estado:** Dirección visual aprobada por el usuario; especificación
pendiente de aprobación final de Codex. Este documento es solo la
especificación de diseño; no se implementa hasta que exista un plan
derivado y se apruebe explícitamente.
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

**Responsive (corregido):** los tres enlaces intermedios (Explorar, Cómo
funciona, Sumar mi cocina) se muestran junto a Ingresar/Mi cuenta recién
desde `lg` (1024 px) — no desde `sm` (640 px) como decía una versión
anterior de esta spec: un header de 640 px no tiene espacio real para tres
enlaces de texto más Ingresar/Mi cuenta sin apretarse o romper el layout.
Por debajo de `lg` — esto cubre todo el rango 640–1023 px, no solo mobile
angosto — el header muestra solo logo + Ingresar/Mi cuenta. El acceso a
Explorar y a Sumar mi cocina en ese rango lo cubre `MobileBottomNav`, que
ya se oculta recién en `lg` (`lg:hidden`) — mismo breakpoint, sin
necesitar ningún cambio en ese componente más allá del `aria-label`
descripto abajo. "Cómo funciona" es una sección de la misma página `/`,
alcanzable haciendo scroll, sin acceso directo desde el header por debajo
de `lg`.

Como el Header es global, este cambio se verifica visualmente en **todas**
las rutas existentes (`/`, `/explorar`, `/login`, `/registro`, `/viandera`,
`/app`, `/admin`, `/{slug}`), no solo en la portada — ver Criterios de
aceptación y Plan de validación. La verificación cubre explícitamente
**640, 768 y 1024 px**, **con sesión iniciada y sin sesión** (el header
alterna "Ingresar"/"Mi cuenta" según ese estado), y **zoom de texto al
200%** en esos mismos tres anchos.

**Nombres accesibles distintos:** el `<nav>` del header pasa a tener
`aria-label="Navegación principal"` (hoy no tiene ninguno) y el `<nav>` de
`MobileBottomNav` pasa de `aria-label="Navegación principal"` (su valor
actual, idéntico al que recibe ahora el header) a `aria-label="Navegación
principal móvil"`. Este es el único cambio a `MobileBottomNav.tsx` en toda
esta entrega — solo el atributo, sin tocar su lógica, sus ítems ni su
breakpoint — pero como es un componente compartido con `/explorar`, se
verifica que esa ruta siga funcionando igual después del cambio (ver
Criterios de aceptación y Arquitectura, sección 10). `DesktopSidebar`
(exclusivo de `/explorar`) sigue usando `aria-label="Navegación
principal"` sin cambios — el landmark duplicado que eso genera junto al
header en desktop dentro de `/explorar` queda anotado en Fuera de alcance,
sin bloquear esta spec.

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
exclusivamente fotográfico — no lleva su propio título ni CTA (sí lleva su
propio control de reproducción, ver sección 5); el título, la bajada, el
buscador y los filtros rápidos del hero permanecen fijos mientras el
carrusel rota.

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
aprobado, **inmediatamente debajo del título y antes de la grilla de
tarjetas** (corregido — no debajo de la grilla) va una aclaración chica:
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
  nunca el formulario en sí. `FormularioInteres.tsx` ya es un Client
  Component hoy (usa `useActionState`) — envolverlo acá no agrega ningún
  Client Component nuevo, ver sección 6 y 10.
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

`components/consumer/MobileBottomNav.tsx` se reutiliza **sin cambios de
comportamiento** — mismos tres ítems (Inicio, Explorar, Sumar mi cocina),
mismo componente, mismo breakpoint (`lg:hidden`); el único cambio es su
`aria-label` (ver sección 4.1). Se monta en `/` para `< lg` (igual que ya
se monta en `/explorar`), sin agregar `DesktopSidebar` a la portada — la
portada no tiene sidebar en ningún ancho, esa navegación es exclusiva de
`/explorar`. El padding inferior del `body` que reserva espacio para esta
barra (`body:has([data-consumer-bottom-nav])`, ya definido en
`app/globals.css`) se activa automáticamente al montar este componente,
sin necesitar ningún cambio de CSS.

## 5. Carrusel

Componente Client Component chico y aislado: **`HeroCarousel` es el único
Client Component nuevo dentro del hero.** Esto no lo convierte en el único
componente cliente de la portada — `FormularioInteres.tsx` (dentro de la
sección 4.8) y `MotionProvider`/`Reveal.tsx` (ya usados hoy en la landing
actual) ya son Client Components existentes, sin relación con este cambio
— ver sección 6 y 10.

**Contenido:**

- **3 a 4 fotografías**, según el prerrequisito de recursos de la sección
  8 — ver también la regla de honestidad más abajo sobre qué imágenes
  pueden usarse desde el arranque de esta entrega.
- **Transición:** crossfade de aproximadamente 500 ms entre imágenes.
- **Alt text:** cada imagen lleva `alt` descriptivo del contenido real de
  la foto (ej. "Milanesa napolitana con puré de papas servida en un
  contenedor de vianda"), nunca `alt=""` — las fotos son contenido
  informativo, no decorativo.

**Controles:** flechas (anterior/siguiente), indicadores (uno por imagen,
clicables), gesto de swipe en touch, y el botón de reproducción descripto
abajo.

**Comportamiento de reproducción (corregido — cumplimiento de WCAG 2.2.2,
Pausar/Detener/Ocultar):**

- **Rotación automática cada 6 segundos**, sujeta al estado explícito de
  reproducción de abajo.
- **Control de reproducción visible y operable por teclado:** un botón
  que alterna entre "Pausar presentación" y "Reanudar presentación" (con
  estado accesible actualizado — `aria-pressed` o equivalente — y el
  texto visible refleja la acción disponible: dice "Pausar presentación"
  mientras rota, "Reanudar presentación" mientras está pausado). Este
  botón es la **única fuente de verdad** sobre si el carrusel rota: la
  elección del usuario **persiste** aunque pierda el hover o el foco, y
  no se revierte automáticamente.
- **Pausa temporal por hover/foco:** pasar el mouse por encima o recibir
  foco de teclado dentro del carrusel detiene la rotación mientras dure
  esa interacción — es un comportamiento transitorio que **no reemplaza
  ni modifica** el estado del botón de reproducción. Al perder el
  hover/foco, la rotación se reanuda únicamente si el estado explícito
  seguía en "reproduciendo"; si el usuario ya la había pausado con el
  botón, permanece pausada.
- **`prefers-reduced-motion: reduce`:** el carrusel arranca con el
  autoplay **desactivado** (el botón muestra "Reanudar presentación"
  desde el inicio) y las imágenes solo cambian por una acción explícita
  del usuario — flechas, indicadores, swipe, o el propio botón si decide
  activar la rotación por su cuenta. El sistema nunca inicia la rotación
  automáticamente cuando esta preferencia está activa; activarla siempre
  requiere una acción explícita.

**Semántica accesible del carrusel:**

- El contenedor se identifica como carrusel para tecnología de asistencia
  (ej. `role="region"` con `aria-roledescription="carrusel"` y un
  `aria-label` descriptivo, siguiendo el patrón de carrusel de las
  WAI-ARIA Authoring Practices).
- Flechas con `aria-label="Imagen anterior"` y `aria-label="Imagen
  siguiente"`.
- Indicadores con `aria-label="Ir a imagen N"` (N = número de imagen) y
  estado actual accesible (ej. `aria-current="true"` en el indicador de
  la imagen visible).
- Las rotaciones automáticas **no** se anuncian mediante una región viva
  (`aria-live`) — anunciar cada cambio automático cada 6 segundos sería
  ruido constante para lectores de pantalla.
- Si se anuncia un cambio de imagen iniciado por el usuario (ej. al usar
  flechas o indicadores), el anuncio debe ser breve (ej. "Imagen 2 de 4")
  y no repetitivo.
- **Teclado y foco:** flechas, indicadores y el botón de reproducción son
  elementos enfocables y accionables con Enter/Espacio, en un orden de
  foco lógico (flechas → indicadores → botón de reproducción, o el orden
  visual equivalente). Foco visible en todos. Todos los controles miden
  al menos 44 × 44 px.

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
- **Las 3–4 fotografías iniciales son un prerrequisito de esta entrega,
  no algo diferido** (corregido — ver sección 6 y 8): pueden ser
  fotografías ilustrativas (no de platos reales publicados todavía),
  siempre que sean archivos locales del proyecto (no enlaces externos
  inestables), legalmente utilizables (stock con licencia adecuada, o
  fotos encargadas/tomadas para ViandApp) y estén rotuladas "Imagen
  ilustrativa" según la regla de arriba. Lo que sí queda fuera de alcance
  es la sustitución *posterior* de esas imágenes iniciales por
  fotografías reales de platos y cocinas concretas — ver Fuera de
  alcance.
- El carrusel **no se considera terminado** si queda vacío, si depende de
  enlaces de imagen externos inestables (URLs de terceros sin control de
  ViandApp), o si alguna de sus imágenes se muestra rota. Ver el fallback
  visual de marca de abajo para el caso de una imagen que falla en tiempo
  de ejecución.

**Fallback visual ante una imagen que falla:**

- Si una imagen no carga (falla de red, archivo faltante, imagen
  corrupta), esa posición del carrusel muestra un panel de marca en vez
  de un ícono de imagen rota o un hueco en blanco — mismo patrón que ya
  usa `DishCard` para "Sin foto" (`bg-soft-teal` con texto/ícono en vez de
  dejar el espacio vacío), adaptado a las medidas del panel del carrusel
  (sección 8). Ese panel de fallback conserva las dimensiones fijas del
  carrusel para no producir salto de layout (CLS) — ver sección 7.3.
- El fallback nunca contiene un plato, precio o cocina inventados —
  respeta la misma regla de honestidad que el resto de la portada.

## 6. Componentes

```text
components/
  landing/
    PortadaHero            (nuevo — Server Component: kicker, H1, bajada;
                             envuelve GlobalSearch, HeroQuickFilters y
                             HeroCarousel — secciones 4.2 a 4.5)
    HeroCarousel            (nuevo — Client Component, único Client
                             Component NUEVO dentro del hero — sección 5)
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
    FormularioInteres       (existente — Client Component ya hoy, sin
                             cambios funcionales)
    MotionProvider / Reveal (existentes — Client Components ya hoy, sin
                             relación con esta entrega)
    icons.tsx                (existente — se reutilizan `IconPlato`,
                             `IconMoneda`, `IconPin`; no se agregan
                             íconos nuevos)
  consumer/
    GlobalSearch             (existente — se reutiliza tal cual dentro
                             de `PortadaHero`)
    DishCard                 (existente — se reutiliza tal cual dentro
                             de `DescubriHoy`, sin migrar a `next/image`
                             — ver sección 13)
    ResultsSkeleton           (existente — se reutiliza tal cual o con
                             el conteo recortado a 8, como `fallback`
                             del Suspense de `DescubriHoy`)
    MobileBottomNav           (existente — se reutiliza con un único
                             cambio, su `aria-label` — sección 4.1/4.11)
  layout/
    Header                    (existente — modificado in place: agrega
                             los enlaces Explorar y Cómo funciona, y un
                             `aria-label` a su `<nav>` — sección 4.1)
    Footer                    (existente — sin cambios funcionales,
                             solo ajustes visuales menores — sección 4.10)
```

`DesktopSidebar` no se usa en esta portada (queda exclusivo de
`/explorar`, sin cambios — ver sección 4.11 y 4.1). `app/(consumer)/
page.tsx` se reescribe in place para componer los bloques nuevos de
arriba; no se crea ninguna ruta ni ningún archivo nuevo bajo `app/`.

**Aclaración sobre Client Components:** de todo lo nuevo que agrega esta
portada, solo `HeroCarousel` es Client Component — los demás bloques
nuevos (`PortadaHero` salvo el carrusel, `HeroQuickFilters`, `FranjaValor`,
`DescubriHoy`, `CocinasFundadoras` salvo el formulario que envuelve,
`RecorridoConsumidor`) son Server Components. Ninguno de esos bloques
nuevos se envuelve en `Reveal` en esta spec — si el plan de implementación
decide agregar animación de entrada a alguno, es una decisión explícita de
esa etapa, no algo que esta spec asuma.

**Prerrequisito de recursos:** antes de poder implementar y probar
`HeroCarousel` hace falta contar con las 3–4 fotografías locales descriptas
en la sección 5 y medidas en la sección 8 (formato WebP/AVIF, peso
objetivo, ilustrativas o reales según corresponda), guardadas como
archivos del proyecto (ej. bajo `public/portada/`, a confirmar en el plan)
— nunca como URLs externas. El plan de implementación derivado de esta
spec debe incluir la preparación de esos archivos como una tarea propia,
antes o junto con la tarea de `HeroCarousel`, no como un paso implícito.

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
- **Error de consulta (excepción atrapada, corregido):** un mensaje
  honesto que invita a reintentar más tarde, **sin usar `/explorar` como
  solución principal** — esa ruta comparte la misma `buscarPlatos` y
  puede estar sufriendo el mismo error. Ej.: "No pudimos cargar los
  platos disponibles ahora mismo. Volvé a intentarlo en un rato."
  Opcionalmente, un enlace secundario a `/explorar` puede acompañar el
  mensaje, aclarando explícitamente que el catálogo completo también
  podría estar temporalmente afectado (ej. "También podés probar en
  /explorar, aunque puede tener el mismo problema por ahora."), nunca
  presentado como una alternativa garantizada. No se agrega un botón de
  reintento del lado del cliente — ampliaría el alcance de esta sección
  sin necesidad real; recargar la página ya alcanza para reintentar la
  consulta del servidor. Este mensaje no debe poder confundirse con "no
  hay platos cargados": un fallo técnico no es lo mismo que un catálogo
  vacío.
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

- Si por algún motivo una imagen no carga (falla de red, archivo
  faltante, imagen corrupta), esa posición muestra el panel de fallback
  de marca de la sección 5, nunca un ícono de imagen rota ni un hueco en
  blanco — el carrusel reserva su espacio con dimensiones fijas (ver
  medidas, sección 8) independientemente de si la imagen cargó, evitando
  salto de layout (CLS).

## 8. Medidas de recursos

Estas medidas aplican **exclusivamente a las imágenes del carrusel del
hero** (`HeroCarousel`, sección 5) — no a las fotos de plato que cada
viandera ya sube a Supabase Storage y que `DishCard` sigue sirviendo sin
cambios (ver sección 4.7 y la aclaración de la sección 13 sobre
`next/image`). Preparar y optimizar las 3–4 imágenes según esta tabla es
un **prerrequisito de esta entrega** (ver sección 6), no una decisión
diferida — la sección 15 acota qué sigue realmente fuera de alcance (el
reemplazo posterior por fotos reales de platos y cocinas concretas).

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
  resultados todavía", y nunca se resuelve señalando una ruta que
  comparte la misma consulta como si fuera una alternativa garantizada
  (sección 7.1).
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
- **Server Components por defecto.** `HeroCarousel` es el **único Client
  Component nuevo** que agrega esta portada (necesita estado de
  reproducción, índice actual, temporizador y listeners de
  teclado/hover/swipe — sección 5). Esto no lo vuelve el único componente
  cliente de la página en términos absolutos: `FormularioInteres.tsx` (ya
  existente, dentro de `CocinasFundadoras`) y `MotionProvider`/
  `Reveal.tsx` (ya existentes, usados hoy en la landing actual) siguen
  siendo Client Components sin relación con este cambio. Todo lo demás
  nuevo (hero salvo el carrusel, filtros rápidos, franja de valor,
  sección de platos destacados, sección de cocinas fundadoras salvo el
  formulario que envuelve, recorrido, footer) es Server Component.
- **El carrusel queda aislado** en su propio archivo Client Component
  (`components/landing/HeroCarousel.tsx`, ver sección 6), sin arrastrar el
  resto del hero a `"use client"` — el H1, la bajada, el buscador y los
  filtros rápidos siguen siendo Server Components renderizados alrededor
  de ese componente aislado.
- **No rompe rutas existentes.** `/explorar`, `/{slug}`, `/login`,
  `/registro`, `/viandera`, `/app`, `/admin` y el formulario de
  interesados siguen funcionando igual. Los componentes compartidos que
  esta portada modifica son `Header.tsx` (agrega dos enlaces y un
  `aria-label` a su `<nav>`) y `MobileBottomNav.tsx` (cambia únicamente su
  `aria-label` a "Navegación principal móvil", sin tocar su lógica, sus
  ítems ni su breakpoint — ver sección 4.1); ningún otro archivo fuera de
  `app/(consumer)/page.tsx` y los componentes nuevos bajo
  `components/landing/` necesita cambios.
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
1440 px** de ancho (más 640 px para el breakpoint del header — ver
sección 4.1).

- Sin scroll horizontal accidental en ningún ancho de esa lista.
- Objetivos táctiles de al menos 44 × 44 px en todo elemento clickeable:
  botones del buscador, filtros rápidos, flechas/indicadores/botón de
  reproducción del carrusel, enlaces del header, ítems de la navegación
  inferior, campos y botón del formulario.
- Hero: apilado (texto fijo arriba, panel del carrusel abajo) en mobile;
  dos columnas (texto fijo a la izquierda, panel del carrusel a la
  derecha) en desktop — ver decisión de layout fija en la sección 4.2, sin
  variantes de fondo pleno.
- Ancho máximo de contenido en desktop: 1440 px, igual que ya define el
  spec de `/explorar` para `ConsumerShell`.
- El header muestra sus enlaces completos recién desde `lg` (1024 px); por
  debajo (incluido 640–1023 px) solo logo + Ingresar/Mi cuenta — ver
  sección 4.1.
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
- **Carrusel — control explícito, no solo hover/foco (WCAG 2.2.2,
  Pausar/Detener/Ocultar):** el carrusel expone un botón visible "Pausar
  presentación" / "Reanudar presentación" cuyo estado persiste
  independientemente del hover o el foco. El hover y el foco siguen
  pausando temporalmente la rotación mientras duran, pero no sustituyen
  ese control ni alteran su estado. Con `prefers-reduced-motion: reduce`,
  el autoplay arranca desactivado y solo se activa por una acción
  explícita del usuario. Ver comportamiento completo en la sección 5.
- **Semántica del carrusel:** contenedor identificado como carrusel para
  tecnología de asistencia; flechas con `aria-label="Imagen anterior"` /
  `"Imagen siguiente"`; indicadores con `aria-label="Ir a imagen N"` y
  estado actual accesible; las rotaciones automáticas no se anuncian por
  región viva, y un anuncio de cambio iniciado por el usuario (si existe)
  es breve y no repetitivo; orden de foco lógico entre flechas,
  indicadores y el botón de reproducción. Ver el detalle completo en la
  sección 5.
- Sin movimiento obligatorio: ninguna animación de esta portada (entrada
  de secciones, crossfade del carrusel) es indispensable para entender o
  usar el contenido; todas respetan `prefers-reduced-motion`.
- Zoom de texto al 200% sin pérdida de contenido ni superposición rota
  (verificar especialmente el hero, donde el panel del carrusel y el
  bloque de texto son elementos separados que deben poder reflowear a
  apilado si hace falta sin recortar ni tapar el texto; y el header, cuyo
  layout de navegación cambia de compacto a completo según el ancho — ver
  sección 4.1).
- Imágenes con `alt` descriptivo (fotos del carrusel y de las tarjetas de
  platos) o `alt=""` solo cuando sean puramente decorativas — ninguna
  imagen de esta portada lo es, todas son contenido.
- Landmarks: el header sigue siendo el único `<header>`, el footer el
  único `<footer>`, y `app/layout.tsx` sigue proveyendo el único
  `<main>` — igual que ya establece `ConsumerShell` para `/explorar`, esta
  portada no anida un segundo `<main>`. El `<nav>` del header y el de
  `MobileBottomNav` usan nombres accesibles distintos ("Navegación
  principal" y "Navegación principal móvil" respectivamente — ver
  sección 4.1) para no confundirse entre sí en tecnología de asistencia.
- Todo control interactivo nuevo (incluido el botón de reproducción del
  carrusel) mide al menos 44 × 44 px, igual que el resto del sitio.

## 13. Rendimiento y SEO

- **Presupuesto de rendimiento (corregido — criterio medible):** en un
  build de producción (`next build` + `next start`, nunca `next dev`), en
  la misma máquina, mismo navegador y mismo viewport para comparar
  antes/después, la portada mobile cumple **Lighthouse Performance ≥ 90**
  y **LCP ≤ 2.5 s**, medidos con Lighthouse en modo mobile emulado con el
  throttling estándar de la herramienta. Este criterio reemplaza
  cualquier afirmación cualitativa tipo "el LCP no empeora".
- **`priority` se aplica solamente a la primera imagen visible** del
  carrusel (la que se muestra al cargar la página) — las demás (2ª a 4ª)
  cargan en diferido (lazy) y **no** deben descargarse todas con
  prioridad alta, para no competir por ancho de banda con la primera
  imagen ni con el resto del contenido above-the-fold.
- La sección "Descubrí qué hay para hoy" se resuelve en un límite
  `<Suspense>` separado (sección 7.1) precisamente para que su consulta a
  Supabase no bloquee el render ni el LCP del hero, que no depende de
  ella.
- **`next/image` aplica al carrusel, no a toda la portada (corregido):**
  el requisito de `next/image`, crops responsive, `priority` en la
  primera imagen y carga diferida en las restantes es obligatorio para
  `HeroCarousel` (sección 5, medidas en sección 8). **No** aplica a
  `DishCard`: ese componente se reutiliza sin cambios (sección 4.7) y
  sigue sirviendo las fotos de plato con `<img>` simple, como ya hace hoy
  en `/explorar` — migrar `DishCard` a `next/image` queda fuera de esta
  entrega (ver Fuera de alcance), no es algo que esta spec autorice ni
  requiera.
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
- El carrusel cuenta con 3–4 fotografías locales reales (prerrequisito de
  las secciones 5, 6 y 8) — nunca queda vacío, no depende de enlaces
  externos inestables, y ninguna imagen se muestra rota; una imagen que
  falla en tiempo de ejecución cae al panel de fallback de marca de la
  sección 5, no a un hueco en blanco ni a un ícono de imagen rota.
- El carrusel expone un botón "Pausar presentación" / "Reanudar
  presentación" cuyo estado persiste al perder el hover o el foco; hover
  y foco solo pausan temporalmente sin alterar ese estado.
- Con `prefers-reduced-motion: reduce`, el carrusel arranca sin autoplay
  y solo cambia de imagen por una acción explícita del usuario.
- Flechas, indicadores y contenedor del carrusel llevan la semántica
  accesible de la sección 5 (`aria-label`s específicos, identificación
  como carrusel, sin anuncios automáticos por región viva).
- La sección "Descubrí qué hay para hoy" nunca muestra un plato, precio o
  cocina que no exista realmente en la base — sus tres estados (con
  resultados / vacío / error) son visualmente distinguibles entre sí, y
  la aclaración "Los menús pueden cambiar..." aparece **inmediatamente
  debajo del título, antes de la grilla de tarjetas**.
- El estado de error de "Descubrí qué hay para hoy" no presenta
  `/explorar` como solución garantizada (esa ruta comparte `buscarPlatos`
  y puede estar sufriendo el mismo error) — el mensaje principal invita a
  reintentar más tarde, sin botón de reintento del lado del cliente.
- El formulario de cocinas fundadoras sigue insertando filas reales en
  `interesados_viandera` sin ningún cambio de comportamiento respecto de
  hoy.
- El header (global) muestra Explorar, Cómo funciona, Sumar mi cocina e
  Ingresar/Mi cuenta juntos recién desde `lg` (1024 px); por debajo
  (incluido 640–1023 px) muestra solo logo + Ingresar/Mi cuenta, y no
  rompe visualmente ninguna otra ruta del sitio.
- El `<nav>` del header y el de `MobileBottomNav` tienen `aria-label`
  distintos ("Navegación principal" / "Navegación principal móvil").
- La navegación inferior mobile aparece en `/` para `< lg`, con los
  mismos tres ítems que ya usa `/explorar`.
- Sin scroll horizontal accidental ni objetivos táctiles menores a
  44 × 44 px en 320, 375, 768, 1024 y 1440 px, incluidos los controles
  nuevos del carrusel.
- Contraste AA en todo texto, incluido el texto sobre el hero `teal`.
- Zoom de texto al 200% sin pérdida ni superposición de contenido,
  verificado también en 640, 768 y 1024 px, con y sin sesión iniciada.
- `/explorar`, `/{slug}`, `/login`, `/registro`, `/viandera`, `/app` y
  `/admin` siguen funcionando exactamente igual que antes de este cambio.
- `DishCard` no cambia — sigue sirviendo fotos de plato con `<img>`
  simple, sin migrar a `next/image` en esta entrega.
- Lighthouse Performance ≥ 90 y LCP ≤ 2.5 s en un build de producción
  mobile, misma máquina/navegador/viewport en la comparación antes/
  después (ver sección 13).
- No se agrega ninguna llamada a `lib/analitica/eventos.ts` ni ninguna
  escritura nueva en `eventos_analitica`.
- No hay ningún cambio en el schema, RLS, policies o datos de Supabase.

## 15. Fuera de alcance

- **Reemplazo posterior de las fotografías iniciales del carrusel por
  fotos reales de platos y cocinas concretas** (corregido — la
  preparación *inicial* de 3–4 fotografías, ilustrativas o reales, es un
  prerrequisito de esta entrega, no algo diferido; ver secciones 5, 6 y
  8). Decidir cuáles fotos reales reemplazan a las ilustrativas, una vez
  que existan más platos con fotos de calidad suficiente, es trabajo
  posterior.
- **Migración de `DishCard` a `next/image`** — sigue usando `<img>` sin
  cambios en esta entrega (ver sección 13); migrarlo es una tarea
  separada, no autorizada por esta spec.
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
- **Landmark duplicado entre el header y `DesktopSidebar` en
  `/explorar`:** ambos quedan con `aria-label="Navegación principal"` en
  desktop (esta spec distingue el header de `MobileBottomNav`, sección
  4.1, pero no toca `DesktopSidebar`). Queda anotado como una corrección
  de accesibilidad posterior, sin bloquear esta spec.

## Plan de validación visual y funcional

Antes de dar por aprobada la implementación (cuando exista):

1. **Cinco anchos:** 320, 375, 768, 1024 y 1440 px — capturar cada sección
   de la portada, confirmar ausencia de scroll horizontal y de objetivos
   táctiles menores a 44 px.
2. **Recursos del carrusel:** confirmar que las 3–4 imágenes locales
   requeridas (sección 5/6/8) existen, están optimizadas (WebP/AVIF,
   dentro del peso objetivo) y — si son ilustrativas — están rotuladas
   "Imagen ilustrativa"; confirmar que ninguna depende de un enlace
   externo inestable.
3. **Carrusel — reproducción:** verificar rotación de 6 s y crossfade;
   confirmar que el botón "Pausar presentación"/"Reanudar presentación"
   funciona por mouse y por teclado, que su estado persiste al mover el
   mouse fuera o quitar el foco, y que hover/foco solo pausan
   temporalmente sin alterar ese estado; confirmar que con
   `prefers-reduced-motion: reduce` el carrusel arranca sin autoplay y
   que activar la rotación requiere una acción explícita.
4. **Carrusel — semántica y controles:** confirmar `aria-label`s de
   flechas ("Imagen anterior"/"Imagen siguiente") e indicadores ("Ir a
   imagen N"), identificación del contenedor como carrusel, ausencia de
   anuncios automáticos por región viva, orden de foco lógico, controles
   ≥44×44 px, y funcionamiento por swipe en un ancho mobile real (no solo
   emulado). Confirmar que ninguna imagen lleva overlay de precio/negocio
   inventado, y que una imagen forzada a fallar cae al panel de fallback
   de marca, no a un ícono roto ni a un hueco en blanco.
5. **Recorrido de datos reales:** con las 1–2 vianderas y los 2 platos que
   ya existen en el Supabase real (o los que existan al momento de
   implementar), confirmar que "Descubrí qué hay para hoy" los muestra
   correctamente enlazando a su `/{slug}`, y que la aclaración "Los menús
   pueden cambiar..." aparece inmediatamente debajo del título, antes de
   la grilla.
6. **Estado vacío:** simular (en un entorno de prueba, no en producción)
   que `buscarPlatos` devuelve `[]` y confirmar que aparece la invitación
   al piloto, no una grilla vacía ni platos inventados.
7. **Estado de error:** simular un fallo de la consulta y confirmar que el
   mensaje invita a reintentar más tarde sin presentar `/explorar` como
   solución garantizada, que es visualmente distinto del estado vacío, y
   que el resto de la portada (hero, formulario) sigue funcionando con
   normalidad.
8. **Formulario:** confirmar que sigue insertando en `interesados_viandera`
   sin cambios de comportamiento (mismos tres estados `idle`/`ok`/`error`).
9. **Header en todas las rutas y anchos:** navegar `/`, `/explorar`,
   `/login`, `/registro`, `/viandera`, `/app`, `/admin` y un `/{slug}`
   real, en 640, 768 y 1024 px, con sesión iniciada y sin sesión;
   confirmar que el header nuevo muestra los tres enlaces intermedios
   recién desde 1024 px, que no rompe ninguna de esas páginas, que
   "Cómo funciona" resuelve a `/#como-funciona` correctamente desde una
   ruta distinta de `/`, y que el `<nav>` del header y el de
   `MobileBottomNav` tienen `aria-label` distintos.
10. **Accesibilidad:** navegación completa por teclado del header,
    buscador, filtros rápidos, carrusel (incluido el botón de
    reproducción) y formulario; verificación de contraste AA con una
    herramienta automática sobre el hero `teal`; zoom de texto al 200%
    en los tres anchos del punto 9.
11. **Lighthouse / Core Web Vitals:** en un build de producción
    (`next build` + `next start`), misma máquina/navegador/viewport
    mobile para comparar antes/después, confirmar Lighthouse Performance
    ≥ 90 y LCP ≤ 2.5 s; confirmar que `priority` se aplica solo a la
    primera imagen visible del carrusel y que las restantes no descargan
    con prioridad alta; confirmar que la sección de platos destacados
    está detrás de `Suspense`.
12. **Consola limpia:** sin errores de JS ni de red en ninguna de las
    rutas visitadas en el punto 9.
