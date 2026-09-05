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
4. Ejecutá `npm run test:integration`.

Las pruebas deben usar datos sintéticos y limpiar únicamente los registros
identificados por los IDs generados por cada test. No reutilices ni borres
datos que no haya creado el propio test.

## Dependencia de Carrito/Pedidos

El harness local está listo, pero el gate de dependencia sigue pendiente:
no continuar a Task 1 ni ejecutar tests de integración de Pedidos hasta que
la migración de Carrito/Pedidos esté autorizada, aplicada y validada en
`viandapp-staging`. Al completarse, registrar aquí el commit y la fecha de
aplicación; todavía no hay commit ni fecha para registrar.
