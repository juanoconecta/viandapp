# Explorador de consumidores — Diseño (MVP)

**Fecha:** 2026-09-03
**Estado:** Aprobado — recorte al alcance de la primera entrega (`/explorar`)
**Referencia visual:** Gromuse, adaptado a una red local de viandas
**Fuente:** copia recortada de `viandapp-interface-spec.md` (Codex, 2 de
septiembre de 2026), ajustada a lo que implementa
`docs/superpowers/plans/2026-09-03-viandapp-explorador-mvp-implementation-plan.md`

## Resumen

Publicar una entrega medible donde una persona explore viandas reales en
`/explorar`, abra el perfil público de una viandera (`/{slug}`) y continúe a
WhatsApp sin registrarse. `/` sigue siendo la landing de captación de
vianderas — no se reemplaza en esta entrega.

Esta versión recorta la especificación original: el mapa, la geolocalización,
"Disponible hoy" y los sellos de confianza sin respaldo real quedan afuera
(ver "Global Constraints" y "Siguiente entrega" más abajo).

## 1. Objetivo

Permitir que una persona en Rafaela pase de "quiero resolver una comida" a
contactar una viandera por WhatsApp en menos de un minuto, sin registro,
carrito ni checkout.

La experiencia debe sentirse:

- cercana y confiable;
- simple incluso para personas con poca experiencia digital;
- moderna, sin parecer una aplicación genérica de delivery;
- centrada en personas y comida real;
- igualmente útil en celular, tablet y escritorio.

## 2. Principios

1. **Mobile-first.** Se diseña primero para una mano y una pantalla de
   320–430 px.
2. **Una acción primaria por vista.** Buscar, aplicar filtros o abrir un
   perfil.
3. **Sin registro para explorar.** La búsqueda y los perfiles son públicos.
4. **La confianza precede al contacto.** Nombre real, barrio aproximado y
   menú actualizado — solo datos que existen de verdad, nunca sellos
   simulados.
5. **Estados honestos.** Diferenciar sin resultados, sin datos, error
   técnico.

## 3. Sistema visual aprobado

### Colores

| Token | Hex | Uso |
|---|---:|---|
| `paper` | `#FBF2E4` | Fondo general |
| `card` | `#FFFCF6` | Tarjetas y superficies elevadas |
| `ink` | `#362417` | Texto principal |
| `ink-muted` | `#716255` | Texto secundario accesible |
| `coral` (marca) | `#D85A30` | Marca, íconos, focos y texto grande |
| `coral-action` (= `coral-600` existente) | `#B84826` | Botones con texto blanco y enlaces pequeños |
| `teal` | `#1F6F6B` | Navegación, selección y confianza |
| `mostaza` | `#E8A93D` | Acento terciario y fondos de badges |
| `line` | `#E3D6C7` | Bordes y separadores |
| `soft-teal` | `#EAF4F3` | Fondos suaves sobre `teal` |
| `soft-coral` | `#FCE3D9` | Fondos suaves sobre `coral` |

El coral de marca no debe utilizarse como fondo de texto blanco pequeño: su
contraste es insuficiente. Para botones se usa `coral-action` (el token
`coral-600` ya existente en `tailwind.config.ts` — no se duplica el hex).

### Tipografía

- **Baloo 2:** H1, H2, números destacados y mensajes de marca.
- **Inter:** navegación, búsquedas, filtros, botones, precios, formularios y
  contenido.
- Baloo 2 no se usa en descripciones largas ni controles pequeños.

### Densidad y forma

- Unidad de espaciado: 4 px.
- Separación habitual: 8, 12, 16, 24 y 32 px.
- Radio de tarjetas: 16 px.
- Radio de paneles destacados: 20–24 px.
- Botones y filtros: píldora o radio mínimo de 12 px.
- Objetivos táctiles: mínimo 44 × 44 px.
- Sombras suaves; los bordes deben seguir comunicando la estructura sin
  sombra.

## 4. Navegación responsive

Sin mapa, favoritos ni cuenta de consumidor en esta entrega: la navegación
solo ofrece lo que existe.

- **Desktop:** sidebar con Inicio, Explorar y "Sumar mi cocina".
- **Mobile:** navegación inferior fija con Inicio, Explorar y "Sumar mi
  cocina".
- **Tablet:** barra superior completa, navegación compacta sin sidebar
  permanente.
- Ancho máximo del contenido en desktop: 1440 px.
- Sin scroll horizontal accidental entre 320 y 1440 px.

## 5. Página de exploración (`/explorar`)

Reemplaza la combinación "portada + resultados" del diseño original por una
sola ruta pública server-rendered cuyos filtros viven en la URL (querystring),
para que sea compartible y funcione con el botón "atrás".

### Contenido

1. Buscador (`q`, GET sobre `/explorar`).
2. Filtros básicos, aplicados sobre la URL:
   - `tipo`: `todos` | `almuerzo` | `cena`.
   - `etiqueta`: una de `ETIQUETAS_DIETARIAS` o ninguna.
   - `modalidad`: `todas` | `retiro` | `envio`.
3. Resultados reales (hasta 48 platos de vianderas activas y platos
   disponibles).

No hay categorías decorativas sin datos reales detrás, ni sección
"Disponible hoy" — el modelo actual no representa días ni horarios (ver
Global Constraints). No hay filtro de distancia ni de rango de precio en
esta entrega (requieren geolocalización, fuera de alcance).

### Contenido de una tarjeta de resultado

1. Foto del plato (o placeholder sin salto de layout).
2. Nombre del plato.
3. Nombre de la viandera.
4. Barrio (si está cargado).
5. Precio.
6. Modalidad: retiro, envío o ambas.
7. Hasta dos etiquetas dietarias relevantes.

La tarjeta completa abre el perfil de la viandera.

### Estados

- **Cargando:** esqueletos con las dimensiones finales, buscador y
  navegación operables.
- **Vacío:** repetir la búsqueda actual, explicar qué filtros limitan los
  resultados, ofrecer limpiar filtros.
- **Error:** preservar término y filtros, permitir reintento (`reset()`) sin
  reconstruir la búsqueda.
- **Resultado único:** tarjeta destacada, no una grilla vacía alrededor.

## 6. Perfil público de viandera (`/{slug}`)

### Encabezado

- Avatar de iniciales.
- Nombre.
- Bio corta.
- Barrio (si está cargado).
- Modalidades de entrega (retiro/envío, según datos reales).
- Última actualización del menú (`updated_at`).

No se muestran sellos de identidad, teléfono, carnet o habilitación que no
estén respaldados por datos y procesos reales — hoy no existe ningún proceso
de verificación, así que no se simula ninguno.

### Menú

- Cada plato muestra foto, descripción breve, precio, tipo y etiquetas.
- Solo se listan platos `disponible = true` de la viandera.

### WhatsApp

Al elegir "Consultar por WhatsApp":

1. Mostrar una confirmación accesible que explique que disponibilidad,
   entrega y pago se coordinan directamente (acepta Escape, devuelve el
   foco, respeta `prefers-reduced-motion`).
2. Registrar el evento de intención.
3. Abrir WhatsApp con mensaje prellenado.

Mensaje con plato seleccionado:

> Hola, vi tu perfil en ViandApp. Quería consultar por [plato]. ¿Está
> disponible?

Mensaje sin plato seleccionado:

> Hola, vi tu perfil en ViandApp. Quería consultar por tus viandas.

Codificado con `encodeURIComponent`. No incluye precio, dirección ni
promesas de entrega.

### Estados

- **Sin platos:** mostrar bio y datos de la viandera, sin CTA genérico.
- **Sin teléfono:** ocultar el CTA de WhatsApp, sin botón deshabilitado sin
  explicación.
- **Perfil inactivo / slug inexistente:** página 404 de marca, sin exponer
  datos anteriores.
- **Error de carga:** mensaje de reintento, no confundir con perfil
  inexistente.

## 7. Accesibilidad

- Cumplimiento mínimo WCAG 2.2 AA.
- Texto normal con contraste mínimo 4.5:1.
- Foco visible de 2–3 px que no dependa solo del color.
- Navegación completa por teclado.
- Etiquetas accesibles en íconos sin texto.
- `prefers-reduced-motion` desactiva desplazamientos y transformaciones no
  esenciales.
- Las fotos tienen texto alternativo útil; imágenes decorativas usan alt
  vacío.
- No comunicar disponibilidad ni modalidad exclusivamente por color.
- El diálogo de confirmación de WhatsApp atrapa foco, permite Escape y
  devuelve foco al disparador.

## 8. Eventos de medición (MVP)

Recorte de los 11 eventos originales a los 7 que esta entrega puede medir
honestamente, sin PII (`teléfono`, `dirección`, `nombre completo`, contenido
de mensajes ni identificadores de Auth):

| Evento | Propósito |
|---|---|
| `explore_viewed` | Medir entrada a `/explorar` |
| `search_submitted` | Entender intención y términos (sin guardar el texto completo) |
| `filter_applied` | Identificar criterios importantes |
| `profile_viewed` | Medir exposición de cada viandera |
| `dish_selected` | Medir intención por plato |
| `whatsapp_intent` | Confirmación mostrada, antes de salir |
| `whatsapp_clicked` | Clic confirmado en "Continuar a WhatsApp" (no confirma apertura real de la app externa) |

Los eventos se escriben server-side (`createAdminClient()`, sin política de
insert público) después de sanitizar el payload — un visitante no puede
insertar eventos arbitrarios llamando a Supabase directamente. Un fallo de
inserción nunca bloquea el recorrido del usuario.

## 9. Componentes

```text
components/
  consumer/
    ConsumerShell
    DesktopSidebar
    MobileBottomNav
    GlobalSearch
    FilterChips
    DishCard
    EmptyState
    ResultsSkeleton
  storefront/
    StorefrontHeader
    PublicDishCard
    WhatsAppIntent
    StickyContactBar
```

Los componentes existentes se reutilizan o evolucionan cuando su
responsabilidad coincide (p. ej. `app/[slug]/page.tsx` se rediseña in-place,
no se reemplaza). Los stubs `components/viandas/Filtros.tsx` y
`ViandaList.tsx` no se tocan en esta entrega — se retiran en un commit
posterior, solo después de confirmar que no tienen consumidores.

## 10. Flujo de datos esperado

1. La URL de `/explorar` representa búsqueda y filtros — compartible y
   compatible con "atrás".
2. El servidor entrega los resultados y la metadata pública en el primer
   render; no se consulta con service role desde rutas públicas.
3. El perfil público obtiene viandera y platos disponibles mediante
   consultas separables.
4. El clic de WhatsApp registra un evento server-side antes de abrir el
   enlace externo, sin bloquear la salida si falla.

## 11. Criterios de aceptación globales

- Funciona desde 320 px hasta 1440 px sin desplazamiento horizontal
  accidental.
- No requiere cuenta para completar el recorrido hasta WhatsApp.
- Todas las vistas tienen carga, vacío y error diferenciados.
- La navegación principal se utiliza con teclado y lector de pantalla.
- Los filtros se conservan al abrir un perfil y regresar.
- El CTA de WhatsApp nunca aparece si falta un teléfono válido.
- No se inventan ratings, tiempos, disponibilidad o sellos de confianza.
- Las imágenes no provocan saltos de layout.
- Las interacciones principales quedan instrumentadas sin datos personales.

## Global Constraints

Incorporadas literalmente desde el plan de implementación — valen para
todas las tareas de esta entrega:

- Mantener `/` como landing de captación de vianderas.
- Crear `/explorar`; no crear `/explorar/resultados`.
- No implementar mapa, geolocalización, carrito, checkout, pagos, logística,
  ratings, favoritos ni cuentas de consumidor.
- No usar "Disponible hoy"; el modelo actual no representa días ni horarios.
- No mostrar sellos de identidad, teléfono, carnet o habilitación que no
  estén respaldados por datos y procesos reales.
- La exploración y los perfiles son públicos y no requieren registro.
- Usar `coral-action` (`#B84826`) cuando haya texto blanco pequeño sobre
  fondo coral.
- Texto normal: contraste mínimo WCAG 2.2 AA de 4.5:1.
- Mantener `next dev --webpack` y los workers públicos de MapLibre
  existentes, aunque el mapa no participe de esta entrega.
- No envolver formularios con `AnimatePresence mode="wait"` ni
  `motion.form`.
- Cada ruta raíz nueva debe agregarse a `RUTAS_RESERVADAS`.
- No registrar PII en analítica: teléfono, dirección, nombre completo,
  contenido del mensaje ni identificadores de Auth.

## Siguiente entrega (fuera de alcance ahora)

Diferido a planes separados, después de medir uso real de esta entrega:

1. **Mapa.** Marcadores por viandera (no por plato), clustering, selección
   sincronizada lista↔mapa, privacidad de ubicación aproximada, estados de
   permiso de geolocalización, fallback a lista si el mapa falla. La base
   técnica (worker de MapLibre servido desde `public/`, estilo raster) ya
   está resuelta en `components/map/ViandaMap.tsx` y se reutiliza cuando
   este trabajo arranque.
2. Geolocalización del consumidor y filtro de distancia.
3. Disponibilidad por día, horario y "por encargo".
4. Favoritos y cuentas de consumidor.
5. Monetización, planes y facturación.
6. Ratings y moderación, solo si existe un mecanismo verificable de compra.
