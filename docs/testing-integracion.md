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
