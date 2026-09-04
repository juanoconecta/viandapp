# Página pública de la alianza con Puni Rafaela — Diseño

**Fecha:** 2026-09-04 (revisión correctiva 2026-09-04)
**Estado:** Corregido tras revisión de Codex sobre el commit `4196de3` —
pendiente de una segunda revisión antes de implementar. **Parcialmente
desbloqueado**: el WhatsApp oficial y las fuentes de contenido llegaron en
esta revisión (§1); el logo todavía no.
**Depende de:** nada técnicamente. No requiere Carrito, Envíos ni CRM.

## 1. Recursos de Puni — estado actualizado

En la revisión anterior se confirmó que ningún recurso de Puni existía en
el repo ni en las carpetas de assets conocidas. Codex proveyó en esta
revisión:

- **WhatsApp oficial publicado por Puni**: `+54 9 3548 63-5151`.
- **Fuentes oficiales de contenido**: `https://www.puni.ar/comoFunciona`
  y `https://www.puni.ar/queEsPuni`.
- Confirmación explícita de que **ViandApp está autorizado a usar el
  material de Puni**.

Con esto se leyeron ambas páginas oficiales (2026-09-04) para extraer
contenido citable. Resumen de lo que dicen (para uso en §4, con la
atribución que exige §7):

- Puni se autodescribe como "la primera plataforma de logística on-demand
  del interior" (`queEsPuni`).
- Cero comisiones sobre productos — "Puni no interfiere en la venta: solo
  se ocupa de que el envío suceda de forma eficiente" (`comoFunciona`).
- Dos modalidades de entrega: **on-demand** (retiro inmediato) y
  **programada** (`comoFunciona`).
- Asignación automática de repartidor por zona, considerando "cercanía,
  disponibilidad y momento del día" (`comoFunciona`).
- Seguimiento: "tanto el comercio como el repartidor pueden seguir el
  estado del envío y operar con información clara" (`comoFunciona`).

**Sigue faltando**: el archivo de logo en sí. Ninguna de las dos páginas
oficiales tiene una sección de kit de prensa/marca con un logo
descargable — el logo existe en el sitio (renderizado en el header), pero
tomar un recorte de pantalla del sitio como "el" archivo de logo, sin que
el usuario confirme cuál es el archivo/formato correcto (SVG idealmente,
o PNG con fondo transparente en buena resolución), es el tipo de decisión
que esta revisión no toma por su cuenta — se pide explícitamente en el
reporte final. La estructura y el copy de esta spec ya no dependen de
nada más para poder implementarse; **el único bloqueo restante es el
archivo de logo**.

## 2. Objetivo

Sin cambios respecto a la versión anterior: comunicar la alianza
estratégica con Puni Rafaela en la portada (`/`) con un CTA breve, y una
página con más detalle, dejando totalmente claro que cada comercio
contrata a Puni directamente y que ViandApp no administra esa
contratación ni garantiza disponibilidad o tarifas.

## 3. Portada (`/`)

Sin cambios respecto a la versión anterior: bloque propio (Server
Component), texto "Alianza estratégica con Puni Rafaela", logo de Puni
(pendiente del archivo, §1), botón "Conocé más" → `/alianza-puni` (§4,
decisión ahora cerrada), ubicado entre "Descubrí qué hay para hoy" y
"Cocinas fundadoras".

## 4. Página de detalle — decisión cerrada: `/alianza-puni`

**Cerrado en esta revisión**: ruta propia `/alianza-puni`, sumada a
`RUTAS_RESERVADAS` (`lib/viandera/slug.ts`). Ya no es una decisión
abierta entre ruta y anchor.

Contenido:

1. Logo de Puni + logo de ViandApp (pendiente del archivo, §1), texto
   "Alianza estratégica con Puni Rafaela".
2. Explicación de qué es y cómo funciona Puni, con contenido real citado
   de las fuentes oficiales de §1 — el copy puede describir, siempre en
   los términos que las páginas oficiales realmente usan (no
   parafraseado más allá de lo necesario para que fluya como texto de
   ViandApp, y sin reproducir párrafos completos — ver "Copyright" en las
   reglas generales de esta sesión, cita corta y atribuida si se usa
   texto literal):
   - Logística de última milla on-demand para comercios locales.
   - Retiro inmediato o envío programado, a elección del comercio en cada
     pedido.
   - Asignación automática de repartidor por zona.
   - Seguimiento del envío para comercio y repartidor.
   - Cero comisiones sobre el producto vendido (Puni cobra por el
     servicio de envío, no un porcentaje de la venta).
3. Párrafo de transparencia, obligatorio, sin cambios respecto a la
   versión anterior:

   > Cada comercio que se suma a ViandApp contrata el servicio de Puni de
   > forma directa e independiente. ViandApp no administra esa
   > contratación, no interviene en el pago ni en la logística, y no
   > garantiza disponibilidad ni tarifas — esa información depende
   > exclusivamente de Puni.

4. Botón **"Consultar servicios"** →
   `https://wa.me/5493548635151?text=...` (número confirmado en §1,
   normalizado sin espacios/guiones para el link — mismo criterio que
   `telefonoParaWhatsapp`) con un mensaje prellenado neutro. Abre en
   pestaña nueva, `rel="noopener noreferrer"`, `encodeURIComponent`.
5. Mención de que las cocinas adheridas muestran la insignia "Adherido a
   Puni" en su página — sin listarlas acá (spec de Envíos/Adhesión ya
   resuelve dónde vive esa información).

## 5. Lo que esta página NUNCA debe decir o insinuar

- Que ViandApp cobra, procesa pagos, o media económicamente entre el
  comercio y Puni.
- Tarifas específicas de Puni (esas viven por cocina en
  `puni_adhesiones.costo_envio_puni`, cargadas por **la vendedora** una
  vez aprobada — corregido en la spec de Envíos/Adhesión §4 — no un
  número general en esta página pública).
- Cobertura geográfica de Puni como si fuera un dato de ViandApp.
- Cualquier sello, certificación o "verificado" que no sea la
  autorización real ya confirmada de uso de nombre/logo.
- Nada que las fuentes oficiales de §1 no respalden — si el copy final
  quiere afirmar algo que no está en `comoFunciona`/`queEsPuni`, se
  vuelve a consultar con el usuario antes de publicarlo, no se
  extrapola.

## 6. Accesibilidad y responsive

Sin cambios: WCAG 2.2 AA, contraste 4.5:1, objetivos táctiles ≥44px, sin
scroll horizontal 375–1440px.

## 7. Créditos y trazabilidad de la fuente (nuevo en esta revisión)

`public/aliados/CREDITOS-PUNI.md` (mismo patrón que
`public/portada/CREDITOS.md`, ya existente en el proyecto para los
créditos de las fotos del carrusel) documenta, para cada recurso usado:

- **Logo**: archivo, fuente exacta (URL), fecha de obtención, y la
  confirmación de autorización de uso (referenciando esta revisión de
  Codex como el registro de esa autorización, ya que es la fuente de la
  confirmación dentro de este proyecto).
- **Copy**: las dos URLs de §1, fecha de lectura (2026-09-04), y una nota
  de que el texto de ViandApp está inspirado/resumido a partir de esas
  páginas, no citado palabra por palabra salvo donde se marque
  explícitamente entre comillas.
- **WhatsApp**: el número, y la misma fuente/fecha.

## 8. Fuera de alcance de esta entrega

- Listado de cocinas adheridas en esta página.
- Cualquier flujo de auto-servicio para que un comercio "se sume a Puni"
  desde acá.
- Página propia con analítica conectada.
