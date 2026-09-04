# Página pública de la alianza con Puni Rafaela — Diseño

**Fecha:** 2026-09-04
**Estado:** Propuesto — **bloqueado para implementación** hasta recibir los
recursos oficiales de Puni (ver §1). La estructura, copy-guidelines y plan
de tareas de esta spec son completos; el contenido real (logo, número de
WhatsApp, texto autorizado) no lo es porque esos recursos no existen en
este repositorio ni en las carpetas de assets conocidas.
**Depende de:** nada técnicamente. No requiere Carrito, Envíos ni CRM.

## 1. Bloqueo confirmado — recursos de Puni no disponibles

Se inspeccionó explícitamente antes de escribir esta spec:

- `grep -ri "puni"` en todo el repositorio (código, `public/`, docs): **cero
  resultados**.
- Carpeta personal de assets de marca ya usada en este proyecto
  (`D:\jgCM\2026\jc\VIANDAPP\`, de donde salió `pinfinal.png`/`logofinal.png`
  para el logo de ViandApp): contiene solo material propio de ViandApp
  (logo, videos promocionales, spot de audio) — **nada de Puni**.
- Ningún número de WhatsApp de Puni, logo, ni texto de condiciones
  comerciales autorizado por Puni existe en ningún archivo de este repo.

Por lo tanto, **antes de implementar esta entrega hacen falta, provistos
por el usuario (no inventados)**:

1. El logo de Puni en un formato usable (SVG o PNG con fondo transparente,
   idealmente ambos para versión clara/oscura si Puni tiene variantes) y
   confirmación explícita del derecho de uso (el brief dice que existe
   autorización — falta el archivo y, si Puni tiene lineamientos de marca
   como tamaño mínimo/zona de resguardo, esos lineamientos).
2. El número de WhatsApp **oficial y autorizado** de Puni para "Consultar
   servicios" (no un número personal ni de prueba).
3. Cualquier texto que Puni específicamente pida que se use o se evite
   (algunas marcas tienen condiciones sobre cómo se las menciona).

Esta spec y su plan de implementación quedan listos para ejecutarse en
cuanto lleguen — no hace falta rediseñar nada, solo completar los
`TODO(puni-assets)` marcados explícitamente en el plan.

## 2. Objetivo

Comunicar la alianza estratégica con Puni Rafaela en la portada (`/`) con
un CTA breve, y una página/apartado con más detalle, dejando **totalmente
claro** que:

- La alianza es real y autorizada (no una promesa vaga).
- Cada comercio contrata a Puni **directamente**, no a través de ViandApp.
- ViandApp **no administra** esa contratación, pagos, ni logística.
- ViandApp **no garantiza** disponibilidad ni tarifas de Puni.

Este último punto no es solo copy defensivo — es la misma separación de
responsabilidades que ya rige toda la relación con Puni en la spec de
Envíos/Adhesión: ViandApp muestra que una cocina está adherida (verificado
por el admin), pero la relación comercial vive fuera.

## 3. Portada (`/`)

Un bloque nuevo en `/` (Server Component, sección propia — no se mete
dentro de `PortadaHero` ni de `FranjaValor`, tiene su propia identidad
visual y su propia sección, siguiendo la convención de "no repetir la
misma forma de sección dos veces seguidas" de `CLAUDE.md`):

- Texto: **"Alianza estratégica con Puni Rafaela"**.
- Logo de Puni (una vez disponible) junto al texto — con `alt` descriptivo,
  nunca decorativo (`alt=""`) porque comunica información real.
- Botón **"Conocé más"** → navega a la página/apartado de detalle (§4).
- Ubicación sugerida: después de "Descubrí qué hay para hoy" y antes de
  "Cocinas fundadoras" — ni compite con el hero (que es sobre buscar
  comida ahora) ni se pierde al final de la página. Confirmar con el
  usuario si prefiere otra posición al revisar el plan.

## 4. Página/apartado de detalle

Decisión de implementación pendiente de confirmar con el usuario en el
plan: ¿ruta propia (`/alianza-puni`, sumada a `RUTAS_RESERVADAS`) o un
apartado con anchor (`/#alianza-puni`) dentro de la portada? Ambas
cumplen "página o apartado breve" tal como se pidió. Se recomienda **ruta
propia**: es compartible por link directo (útil si Puni quiere linkearla
desde su propio Instagram/WhatsApp), y no infla el peso de `/` con
contenido que la mayoría de las visitas no necesita ver. El plan deja las
dos opciones documentadas para que el usuario elija antes de implementar.

Contenido obligatorio:

1. Logo de Puni + logo de ViandApp, o el texto "Alianza estratégica con
   Puni Rafaela" con ambas marcas presentes.
2. Explicación breve de qué es Puni (uno o dos párrafos — el texto exacto
   depende de qué autorice Puni, no se inventa acá; ver `TODO(puni-assets)`
   en el plan).
3. Párrafo de transparencia, obligatorio, **sin editorializar a favor de
   Puni ni de ViandApp** — algo en la línea de (el texto final se ajusta en
   el plan, esto fija el contenido mínimo):

   > Cada comercio que se suma a ViandApp contrata el servicio de Puni de
   > forma directa e independiente. ViandApp no administra esa
   > contratación, no interviene en el pago ni en la logística, y no
   > garantiza disponibilidad ni tarifas — esa información depende
   > exclusivamente de Puni.

4. Botón **"Consultar servicios"** → `wa.me/<número oficial de Puni>` con
   un mensaje prellenado neutro (ej. "Hola, vi la alianza con ViandApp y
   quería consultar sobre sus servicios de envío") — mismo patrón de
   `encodeURIComponent` que el resto del sitio. Abre en pestaña nueva,
   `rel="noopener noreferrer"`.
5. Mención de que las cocinas adheridas muestran la insignia "Adherido a
   Puni" en su página — enlaza el concepto con la spec de Envíos/Adhesión
   sin duplicar su lógica (esta página no consulta `puni_adhesiones` para
   listar cocinas adheridas; eso ya vive en `/explorar` y en cada
   `/{slug}`, listar acá sería una segunda fuente de la misma información
   sin necesidad).

## 5. Lo que esta página NUNCA debe decir o insinuar

- Que ViandApp cobra, procesa pagos, o media económicamente entre el
  comercio y Puni.
- Tarifas específicas de Puni (esas viven por cocina en
  `puni_adhesiones.costo_envio_puni`, cargadas por el admin tras confirmar
  con Puni — no un número general en esta página pública, que quedaría
  desactualizado y sería una promesa que ViandApp no puede garantizar).
- Cobertura geográfica de Puni como si fuera un dato de ViandApp (si Puni
  quiere comunicar su cobertura, es contenido que Puni provee y autoriza
  explícitamente, no algo que se redacta por inferencia).
- Cualquier sello, certificación o "verificado" que no sea la autorización
  real ya confirmada de uso de nombre/logo.

## 6. Accesibilidad y responsive

Mismos criterios que el resto del sitio (WCAG 2.2 AA, contraste 4.5:1,
objetivos táctiles ≥44px, sin scroll horizontal 375–1440px) — no se
inventa un estándar nuevo para esta página.

## 7. Fuera de alcance de esta entrega

- Listado de cocinas adheridas en esta página (ya existe la insignia por
  cocina, ver §4).
- Cualquier flujo de auto-servicio para que un comercio "se sume a Puni"
  desde acá — la adhesión se solicita desde `/viandera/perfil` (spec de
  Envíos/Adhesión), esta página es informativa/pública, no un formulario.
- Página propia con analítica conectada (la analítica general del sitio
  sigue pausada según `CLAUDE.md`).
