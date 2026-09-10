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
casos: **59 pasaron, 1 falló**.

- `app/admin/crm/sincronizacion.integration.test.ts`: 45 casos (44
  pasaron, 1 falló). Cubre: alta de interesado/viandera como
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
  **1 caso falló, y es un hallazgo real, no un defecto del test**: insertar
  un interesado como `anon` en `interesados_viandera` es rechazado con
  42501 ("new row violates row-level security policy"). Diagnosticado por
  descarte (con clientes reales, sin SQL crudo): `service_role` sí puede
  insertar en esa misma tabla; `anon` sí puede leer `vianderas`/`viandas`
  vía sus policies públicas de `select`. Esto acota el problema a que la
  policy `"cualquiera puede anotarse como interesada"` (documentada en
  `CLAUDE.md`, insert a `anon` con `check (true)`) no está aplicada en
  `viandapp-staging` — consistente con que esa parte del esquema base se
  reconstruyó a mano desde `CLAUDE.md` (ver el registro de arriba) en vez
  de venir de un archivo de migración versionado. No es un defecto de la
  migración de CRM (Task 2) ni de este harness de test; es un gap del
  esquema base de este proyecto de staging, y bloquea hoy la vía real por
  la que el formulario de la landing (que inserta como `anon`) daría de
  alta interesadas ahí. Requiere que alguien con autorización aplique esa
  policy en `viandapp-staging` (o confirme que el gap es aceptable) — no
  se aplicó ninguna corrección de esquema como parte de esta tarea.
- `app/admin/crm/consentimiento.integration.test.ts`: 8 casos, todos
  pasaron. Cubre: alta de consumidor y puente al aceptar marketing; no-alta
  al no aceptar; normalización de tres formatos de teléfono a un solo
  contacto con tres puentes; retiro de consentimiento (conserva
  contacto/puentes, marca timestamp); reactivación in-place por un pedido
  consentido posterior; anonimización (nulea PII, conserva puentes, la
  vista `crm_contactos_resumen` no filtra nombre/contacto aunque el pedido
  en sí retenga su PII); alta de un contacto nuevo tras un consentimiento
  posterior a la anonimización, sin tocar la fila anónima anterior.
- `app/admin/crm/normalizacion.integration.test.ts`: 7 casos, todos
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
