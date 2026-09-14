# Tests de integración

Los tests de integración de ViandApp usan exclusivamente el proyecto de
Supabase staging `viandapp-staging`. Nunca usan producción.

## Preparación local

1. Reactivá `viandapp-staging` si el proyecto gratuito está pausado. Su
   pausa no afecta producción.
2. Copiá `.env.integration.example` a `.env.integration.local` y cargá
   allí las credenciales reales de staging. Ese archivo no se versiona.
3. Confirmá que `NEXT_PUBLIC_SUPABASE_URL` sigue apuntando a producción y
   que `INTEGRATION_SUPABASE_URL` apunta a `viandapp-staging`. El guard
   rechaza que ambas URLs coincidan.
4. `npm run test:integration` carga explícitamente
   `.env.integration.local` con el modo `integration`; no hace falta exportar
   las variables manualmente en la shell.
5. Antes de aplicar **cada** migración, detenete y pedí autorización
   explícita. La autorización para staging no autoriza nunca producción.

Las pruebas deben usar datos sintéticos y limpiar únicamente los registros
identificados por los IDs generados por cada test. No reutilices ni borres
datos que no haya creado el propio test.

## Gates operativos de migraciones

El harness local está listo, pero hay dos gates de dependencia pendientes:

1. **Antes de Carrito/Pedidos:** no continuar a Task 1 ni ejecutar tests de
   integración de Pedidos hasta que la migración esté autorizada, aplicada y
   validada en `viandapp-staging`. Al completarse, registrar aquí el commit y
   la fecha de aplicación; todavía no hay commit ni fecha para registrar.
2. **Antes de CRM:** detenerse y pedir autorización explícita antes de
   aplicar la migración de CRM en `viandapp-staging`; después debe validarse
   allí antes de ejecutar sus tests de integración.

En ambos gates, la autorización es por migración y por target: staging nunca
implica autorización para producción.

### Registro de aplicación — cadena de esquema base + Carrito/Pedidos

Aplicado por el usuario a mano, vía el SQL Editor del Dashboard de Supabase
del proyecto `viandapp-staging` (ref `apjxfcxkzrbbkiemjgsl`, no producción),
en este orden: esquema base + panel de viandera + vidriera pública
(reconstruido desde los bloques SQL de `CLAUDE.md`, porque nunca existió un
archivo de migración versionado para esa parte del esquema) → 
`202609030001_explorador_mvp.sql` → `202609040001_envios_adhesion_puni.sql`
→ `202609040002_carrito_pedidos.sql` (esta última necesitó 2 intentos: partir
una única transacción `begin...commit` en distintos "Run" del SQL Editor no
funciona, cada Run es su propia sesión).

Fecha exacta no registrada en el historial de git (el ledger de trabajo que
la documentó vive en `.superpowers/`, que está gitignored); ocurrió después
de la Task 9 del plan de Carrito/Pedidos (commit `015c018`, 2026-09-06) y
antes de esta entrada (2026-09-10).

Resultado: verificado directamente vía REST después de que el usuario
reportó éxito — las 6 tablas (`vianderas`, `puni_adhesiones`, `pedidos`,
`pedido_items`, `limite_solicitudes`, `eventos_analitica`) devuelven 200; la
RPC `crear_pedido_atomico` existe y su validación interna corre
correctamente (invocada con items nulos deliberadamente inválidos, devolvió
`{"code":"P0001","message":"items_invalidos"}`, el error esperado, sin
escribir datos). Los tests de integración de Carrito/Pedidos en sí (Task 10
de ese plan, `app/pedido/actions.integration.test.ts`) todavía no están
escritos ni corridos — esta entrada solo confirma que el esquema existe y
los caminos felices/de validación son alcanzables.

### Registro de aplicación — CRM integrado

Aplicado por el usuario a mano, vía el SQL Editor del Dashboard de Supabase
del proyecto `viandapp-staging` (ref `apjxfcxkzrbbkiemjgsl`, no producción):
`supabase/migrations/202609050001_crm_integrado.sql`. Fecha exacta no
registrada (mismo motivo que arriba); ocurrió antes de la Task 3 del plan de
CRM (2026-09-10), inmediatamente después del gate de la Task 2.

Resultado: confirmado vía REST antes de empezar la Task 3 — las 5 tablas
nuevas (`crm_contactos`, `crm_contacto_pedidos`, `crm_notas`, `crm_tareas`,
`crm_interacciones`) y la vista `crm_contactos_resumen` devuelven 200. La
Task 3 (más abajo) ejerció además el comportamiento real de sincronización,
consentimiento, aislamiento RLS y paridad de normalización contra esta
aplicación.

### Paso 5 — corrida real de `npm run test:integration` (Task 3, CRM)

Ejecutado contra `viandapp-staging` el 2026-09-10. 3 archivos de test, 60
casos: **60/60 pasaron** (ver corrección de test más abajo — un intento
inicial reportó 1 falla por un defecto del test, no del esquema).

- `app/admin/crm/sincronizacion.integration.test.ts`: 45 casos, todos
  pasaron. Cubre: alta de interesado/viandera como
  `cocina_potencial`/`cocina_activa`; no-duplicación bajo el índice único
  parcial que respalda el `ON CONFLICT` del trigger; backfill (recreación
  de un contacto faltante reproduciendo la precondición exacta, ya que
  `viandapp-staging` no tenía filas previas a la migración para verificar
  contra datos reales); y una matriz de 40 intentos (5 tablas `crm_*` × 4
  operaciones × 2 roles `anon`/`authenticated`, con clientes reales de cada
  rol) confirmando que ninguna de las cinco tablas permite lectura, alta,
  modificación ni borrado sin `service_role`. Esta matriz reemplaza, con
  evidencia estrictamente más fuerte, dos verificaciones del plan
  (`pg_policies` sin filas para `crm_%`; las tres funciones sin privilegio
  de ejecución para `PUBLIC`/`anon`/`authenticated`) que no se pudieron
  re-derivar en vivo sin un driver de Postgres nuevo ni una RPC de
  introspección nueva — se dan por satisfechas por la revisión estática ya
  hecha en la Task 2, que leyó el SQL aplicado byte a byte.

  **Corrección post-implementación** (controller, mismo día): el caso
  "insertar un interesado como `anon` crea un contacto `cocina_potencial`"
  falló inicialmente con 42501 ("new row violates row-level security
  policy"). El diagnóstico original (registrado brevemente acá y luego
  corregido) concluía que a `viandapp-staging` le faltaba la policy base
  `"cualquiera puede anotarse como interesada"` (insert a `anon`). Ese
  diagnóstico era **incorrecto** — verificado con un POST crudo a la REST
  API (sin el SDK) con la misma anon key: el insert solo, sin pedir
  representación de vuelta, devuelve `201`. La causa real: el test
  encadenaba `.insert(...).select().single()`, y `interesados_viandera`
  no tiene (a propósito, ver `CLAUDE.md`: "sin policy de select para anon
  a propósito") ninguna policy de `select` para `anon` — el `RETURNING`
  implícito de `.select()` después del insert exige esa visibilidad bajo
  RLS, y Postgres rechaza el insert entero por no poder satisfacerla,
  aunque el insert en sí esté permitido. El código real de producción
  (`app/(consumer)/actions.ts`) nunca encadena `.select()` ahí, por la
  misma razón de diseño. Corregido quitando `.select()` del insert y
  buscando el id creado después con el cliente `service_role` (que sí
  puede leer la tabla), filtrando por el `contacto` único de esa corrida.
  Sin cambios de esquema en `viandapp-staging` — la policy en cuestión
  siempre estuvo ahí y siempre funcionó.
- `app/admin/crm/consentimiento.integration.test.ts`: 7 casos, todos
  pasaron. Cubre: alta de consumidor y puente al aceptar marketing; no-alta
  al no aceptar; normalización de tres formatos de teléfono a un solo
  contacto con tres puentes; retiro de consentimiento (conserva
  contacto/puentes, marca timestamp); reactivación in-place por un pedido
  consentido posterior; anonimización (nulea PII, conserva puentes, la
  vista `crm_contactos_resumen` no filtra nombre/contacto aunque el pedido
  en sí retenga su PII); alta de un contacto nuevo tras un consentimiento
  posterior a la anonimización, sin tocar la fila anónima anterior.
- `app/admin/crm/normalizacion.integration.test.ts`: 8 casos, todos
  pasaron. Confirma paridad exacta entre `crm_normalizar_contacto` (SQL,
  vivo en staging) y `normalizarContacto` (TypeScript, Task 1) para los 7
  casos de la tabla de test de Task 1.

`npm run test` (suite unitaria, sin credenciales de integración) también se
corrió limpio: 349 tests, 35 archivos, todos verdes — se ajustó
`vitest.config.mts` para excluir `**/*.integration.test.ts` de esa corrida
(antes se colaban por el patrón `**/*.test.ts` y rompían la suite unitaria
al no encontrar credenciales).

Staging quedó limpio al finalizar: se confirmó por conteo real (no solo
inspección del código de limpieza) que las 9 tablas relevantes
(`vianderas`, `interesados_viandera`, `pedidos`, `pedido_items`,
`crm_contactos`, `crm_contacto_pedidos`, `crm_notas`, `crm_tareas`,
`crm_interacciones`) volvieron a 0 filas después de la corrida, y que no
quedó ningún usuario de Auth sintético (`*@viandapp-staging.invalid`)
sin borrar.

### Task 7 — QA integral (2026-09-11)

**Paso 1 — verificación automatizada final**, contra el estado completo
del plan de CRM (Tasks 0-6):

```
npm test               → 39 archivos, 409 tests, todos verdes
npm run test:integration → 3 archivos, 60 tests, todos verdes (contra viandapp-staging real)
npm run lint            → limpio
npx tsc --noEmit        → limpio
npm run build           → compiló sin errores, 20 rutas generadas
```

**Paso 2/3 — QA manual con usuario admin sintético**, contra
`viandapp-staging` con un dev server local apuntado ahí (nunca
producción; credenciales inyectadas por variables de entorno de shell,
sin tocar `.env.local`). Un usuario admin sintético (invitación directa
vía `admin.auth.admin.createUser`) y un usuario autenticado no-admin,
ambos borrados al finalizar:

- Estados vacíos verificados en `/admin`, `/admin/crm`, `/admin/pedidos`,
  `/admin/puni`.
- Redirección confirmada en las tres rutas (`/admin/crm`, `/admin/pedidos`,
  `/admin/puni`) para: sin sesión (→ `/login`) y sesión no-admin (→ `/app`).
- Con datos sintéticos (una viandera, una interesada, un pedido con
  `acepta_marketing=true`): los tres triggers de sincronización
  dispararon correctamente (`cocina_activa`, `cocina_potencial`,
  `consumidor`); listado y detalle del CRM renderizaron los tres
  contactos correctamente, incluida la insignia de consentimiento solo
  para el consumidor.
- Formularios probados de punta a punta: nota, tarea (+ completarla),
  interacción, alta de "aliado_estrategico" vía "Nuevo aliado u otro
  contacto" — los cuatro funcionaron y persistieron.
- **Verificación de privacidad (la más crítica)**: se anonimizó el
  contacto consumidor real — la vista y el listado pasaron a mostrar
  "Contacto anónimo" / "Datos anonimizados" de inmediato, y se confirmó
  por consulta directa a la base que el `pedido` subyacente **retiene**
  `nombre_comprador`/`telefono_comprador` reales mientras que
  `crm_contactos` quedó con `nombre_libre`/`contacto_libre` en `null` —
  el aislamiento funciona de punta a punta, no solo a nivel de tests.
  También se confirmó que una cocina (`cocina_activa`) no muestra ninguna
  insignia de consentimiento ni los botones Retirar/Anonimizar.

**Un hallazgo real corregido en esta etapa** (no un defecto de Task 6,
una corrección de QA como prevé el propio Paso 4 del plan): la fecha de
vencimiento de una tarea (`vence_en`, que viene de un `<input
type="date">` sin hora y se guarda como medianoche UTC) se mostraba con
un día de menos en el detalle del contacto, porque se formateaba en
huso horario local (Argentina, UTC-3) en vez de UTC. Corregido con un
formateador dedicado para ese campo (commit `626c609`); re-verificado
visualmente en el mismo flujo tras el fix.

Staging quedó limpio otra vez al finalizar esta corrida (mismo chequeo
por conteo real + verificación de que no quedó ningún usuario de Auth
sintético).
