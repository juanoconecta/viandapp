# Vidriera pública de la viandera — Diseño

**Fecha:** 2026-08-24
**Estado:** Aprobado, pendiente de plan de implementación

## Resumen

Primer pedazo de la futura webapp de compras estilo Gromuse: una página
pública por viandera (`viandapp.ar/{slug}`) que muestra su perfil y su
menú real — reemplazando el mockup estático "Doña Rosa" que hoy vive en la
landing (`components/landing/PreviewPerfil.tsx`) por una página funcional,
conectada a los datos reales que ya se cargan desde `/viandera`.

Sin carrito, sin pedidos, sin exploración/mapa de vianderas — eso queda
para un sub-proyecto posterior. Esta vuelta es "mostrar", no "vender".

## Fuera de alcance de esta v1

- Página de exploración/mapa/búsqueda de vianderas para el consumidor — la
  landing (`/`) no cambia. La única forma de llegar a `/{slug}` es con el
  link directo, que la viandera comparte por su cuenta (WhatsApp, redes).
- Carrito, pedidos, checkout — la página pública deriva a WhatsApp para
  cerrar el pedido manualmente, igual que el mockup actual.
- Roles múltiples ni cuentas compartidas por comercio — sigue siendo una
  fila de `vianderas` por cuenta, como ya existe.

## Modelo de datos

### Cambio a `vianderas`

```sql
alter table vianderas
  add column slug text unique;
```

Nullable hasta que se genera (ver "Generación de slug"). `unique` evita
que dos negocios terminen con la misma URL.

### Cambio a `viandas`

```sql
alter table viandas
  add column etiquetas text[] not null default '{}';
```

Valores válidos (lista fija, no hay tabla aparte — son 7 opciones, un
array de texto alcanza): `vegetariano`, `vegano`, `sin-tacc`,
`apto-diabetico`, `sin-lactosa`, `picante`, `sin-azucar`.

### Políticas RLS

Ninguna política nueva hace falta. `vianderas`/`viandas` ya tienen SELECT
público (`activo = true` / `disponible = true`) y SELECT/UPDATE propios
para la viandera dueña — el slug y las etiquetas son columnas más en filas
que ya son legibles/editables bajo esas mismas reglas.

## Generación y edición de slug

- **Al invitar** (`invitarViandera`, `/admin`) y **al guardar el perfil
  por primera vez** (`actualizarPerfil`, `/viandera/perfil`): si la fila
  todavía no tiene `slug`, se genera automáticamente a partir de `nombre`
  — minúsculas, sin acentos/diacríticos, espacios y caracteres no
  alfanuméricos convertidos a guiones, guiones repetidos/al borde
  recortados. Ej: "Doña Rosa" → `dona-rosa`.
- **Palabras reservadas**: `admin`, `app`, `auth`, `login`, `registro`,
  `viandera`, `api` — coinciden con rutas que ya existen o son
  previsiblemente necesarias a futuro. Un slug generado o elegido que
  choque con una de estas (o con un slug ya usado por otra viandera) se
  resuelve agregando un sufijo numérico: `dona-rosa-2`, `dona-rosa-3`, así
  hasta encontrar uno libre.
- **Edición posterior**: desde `/viandera/perfil`, la viandera puede
  cambiar su slug en cualquier momento — campo de texto con vista previa
  ("viandapp.ar/tu-slug"), validado del lado del servidor con las mismas
  reglas (reservadas + único, sin loop infinito porque el chequeo de
  unicidad excluye la propia fila).
- Next.js resuelve rutas literales (`/login`, `/admin`, etc.) antes que
  segmentos dinámicos (`/[slug]`) siempre — la lista de reservadas no es
  para evitar un conflicto de ruteo real (Next ya lo resuelve solo), es
  para que ningún negocio termine con una URL confusa o que choque con una
  ruta que se agregue más adelante.

## Página pública (`/{slug}`)

- Ruta nueva a nivel raíz (`app/[slug]/page.tsx`), Server Component,
  pública — sin gate de auth, sin passar por el middleware de `/app`,
  `/viandera` o `/admin`.
- Busca la fila de `vianderas` por `slug`. Si no existe, o existe pero
  `activo = false`, responde `notFound()` (404 real de Next.js, no un
  placeholder ni un redirect).
- Contenido, visualmente basado en `components/landing/PreviewPerfil.tsx`
  (mismo layout: header con iniciales + nombre + badge "Activa", lista de
  platos, CTA de WhatsApp abajo) pero con datos reales:
  - Header: iniciales de `nombre` como avatar, `nombre`, `bio` (si tiene).
  - Botón "Pedir por WhatsApp": `https://wa.me/{telefono}` si `telefono`
    está cargado; si no está cargado, el botón no se muestra (no hay nada
    a donde derivar el pedido).
  - Grilla de platos: **solo `disponible = true`** — un plato pausado por
    la viandera no aparece acá aunque siga existiendo en su panel privado.
    Cada tarjeta: foto (si tiene), nombre, precio, tipo, y las etiquetas
    dietarias como badges chicos (solo las que el plato tenga marcadas).
- Sin mapa, sin ubicación textual (no hay geocoding en este alcance) —
  `lat`/`lng` no se usan en esta página, quedan para cuando exista el
  sub-proyecto de exploración/mapa.

## Tags dietarios en el formulario de platos

- `/viandera/platos/nuevo` y `/viandera/platos/[id]/editar` suman 7
  checkboxes (no radio, un plato puede tener varios o ninguno): **Vegetariano,
  Vegano, Sin TACC (celíaco), Apto diabético, Sin lactosa, Picante, Sin
  azúcar.**
- Se guardan en `viandas.etiquetas` como array de los valores marcados.
- El panel privado (`/viandera`, tarjeta de cada plato) también puede
  mostrarlas como referencia rápida para la viandera, aunque no es
  estrictamente necesario — se decide en el plan si vale la pena el
  espacio visual ahí.

## Testing

Sin framework de testing automatizado (convención ya establecida) —
verificación por typecheck/lint/build más pruebas manuales: cargar un
plato con dos o tres tags marcados, confirmar que aparecen en `/{slug}`;
pausar un plato (`disponible = false`) y confirmar que desaparece de la
vidriera pública pero sigue en el panel privado; poner `activo = false` en
una viandera y confirmar que su `/{slug}` da 404; probar que un slug
elegido a mano igual a una ruta reservada (ej. intentar poner "admin"
como slug) se resuelve con el sufijo numérico en vez de romper algo.

## Riesgos / decisiones a vigilar

- Si en el futuro se agrega una ruta nueva a nivel raíz (ej.
  `/vianderas` para el listado de exploración), hay que sumarla a la
  lista de palabras reservadas — si no, un negocio existente con ese slug
  quedaría con una URL ambigua (aunque, como ya se explicó, Next.js sigue
  resolviendo la ruta literal primero sin romper nada técnicamente, es una
  cuestión de claridad, no de bug).
- El botón de WhatsApp asume que `telefono` es un número argentino válido
  para armar el link `wa.me` — no hay validación de formato en el perfil
  hoy (`actualizarPerfil` guarda el texto tal cual). Si el link no
  funciona por un formato raro, es un problema de datos, no de código;
  fuera de alcance agregar validación de formato de teléfono en esta
  vuelta.
