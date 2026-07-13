# Anexo D · Matriz de trazabilidad

## D.1 Cómo leer las matrices

La trazabilidad conecta cada requerimiento con su historia de usuario, sus casos de uso, las reglas de negocio que aplica y **cómo se verifica**. Referencias:

- **RF / RNF / RN:** requerimientos y reglas de negocio (§2.3, §2.4, §2.5).
- **HU:** historias de usuario con criterios de aceptación (Anexo C).
- **CU:** casos de uso (§3).
- **Verificación:** *Unit `grupo`* = tests unitarios de dominio (§6.2) · *E2E n* = escenario n de la lista end-to-end (§6.4) · *Integridad* = tests de datos académicos (§6.3) · *Manual* = verificación exploratoria en cada versión.
- **—** indica «no aplica»; *(transversal)* indica funcionalidad presente en toda la pantalla, sin un caso de uso propio.

## D.2 Matriz principal: RF → HU → CU → RN → verificación

| RF | Requerimiento | HU | CU | RN | Verificación |
|---|---|---|---|---|---|
| RF-01 | Onboarding inicial | HU-01 | CU-01 | — | E2E 8 |
| RF-02 | Cambio de carrera | HU-02 | CU-02 | RN-11 | E2E 9 (parcial) · Manual |
| RF-03 | Plan por año y cuatrimestre | HU-01, HU-06 | CU-01 | — | Unit `Plan` · E2E 1 |
| RF-04 | Estados de materia | HU-03 | CU-03 | RN-01 | Unit `Store` · E2E 2 |
| RF-05 | Aviso de correlativas | HU-04 | CU-03 | RN-02 a RN-05 | Unit `selectors` · E2E 3 y 4 |
| RF-06 | Materias disponibles | HU-05 | CU-03 | RN-06 | Unit `selectors` |
| RF-07 | Carga de notas | HU-07 | CU-04 | RN-08 | Unit `Store` · E2E 7 |
| RF-08 | Cálculo de promedio | HU-07 | CU-04 | RN-07 | Unit `selectors` · E2E 6 y 7 |
| RF-09 | Panel de correlativas | HU-09 | CU-05 | — | Manual (base de datos del grafo: Unit `Plan`) |
| RF-10 | Árbol de correlativas | HU-10 | CU-06 | — | Unit `Plan` · E2E 4 y 5 |
| RF-11 | Tablero de avance e hitos | HU-06 | (transversal) | RN-07, RN-09 | Unit `selectors` · E2E 1 y 2 |
| RF-12 | Renombrado de optativas | HU-08 | CU-07 | RN-10 | Unit `Store` |
| RF-13 | Perfil local | HU-15 | CU-08 | — | Unit `selectors` (iniciales) · Manual (foto) |
| RF-14 | Backup: exportar e importar | HU-11, HU-12 | CU-09, CU-10 | — | Manual |
| RF-15 | Resumen imprimible / PDF | HU-13 | CU-11 | — | E2E 10 |
| RF-16 | Tutorial de primera visita | HU-01, HU-16 | CU-01, CU-12 | — | E2E 11 |
| RF-17 | Reinicio de datos | HU-14 | CU-13 | — | Manual |
| RF-18 | Instalación como PWA | HU-17 | CU-14 | — | Manual |
| RF-19 | Login con Google + consentimiento | HU-18 | CU-15, CU-16 | RN-12 | Unit `sync` (consentimiento) · Manual (OAuth real) |
| RF-20 | Sincronización multi-dispositivo | HU-18, HU-19 | CU-15 | RN-12 | Unit `sync` (merge/conteos/ida-y-vuelta) · Manual (2 dispositivos + RLS con 2 cuentas) |

## D.3 Reglas de negocio: definición → implementación → verificación

| RN | Regla (resumen) | Dónde se implementa | Cómo se verifica |
|---|---|---|---|
| RN-01 | Cuatro estados por materia | Tipo `Estado` (`types.ts`) · `Store` | Unit `Store` |
| RN-02 | Para cursar: previas al menos en curso | `selectors.previasParaEstado` | Unit `selectors` · E2E 3 |
| RN-03 | Para aprobar: previas aprobadas | `selectors.previasParaEstado` | Unit `selectors` |
| RN-04 | El aviso informa, no bloquea | `StatePopover` + toast con acción | E2E 3 y 4 |
| RN-05 | Optativas y especiales exentas del chequeo | `isSpecial`/`isOpt` (`Plan`) · `StatePopover` | Unit `selectors` · Integridad (optativas sin correlativas) |
| RN-06 | Definición de «disponible» | `selectors.disponibles` | Unit `selectors` |
| RN-07 | Promedio solo con aprobadas con nota | `selectors.promedio` | Unit `selectors` · E2E 7 |
| RN-08 | Nota entera entre 1 y 10 | `Store.setNota` (ajuste al rango) | Unit `Store` |
| RN-09 | Títulos como hitos por año | `selectors.hitos` (`hastaAnio`) | Unit `selectors` · Integridad (títulos → años válidos) |
| RN-10 | Optativa renombrable, hasta 48 caracteres | `Store.setOptName` | Unit `Store` |
| RN-11 | Progreso independiente por plan | Claves de storage por plan (`src/state`) | Unit `Store` (persistencia) · Manual |
| RN-12 | Server solo con cuenta + consentimiento; conflicto lo decide el usuario | `lib/sync` (decidirMerge, consentimiento) · `state/sync` (gate) · `ConsentModal`/`SyncConflicto` | Unit `sync` · Manual |

## D.4 Requerimientos no funcionales: mecanismo → verificación

| RNF | Requerimiento (resumen) | Mecanismo | Verificación |
|---|---|---|---|
| RNF-01 | Datos en el dispositivo; server solo con cuenta y consentimiento | Local-first (ADR-01) + sync opcional con RLS y gate de consentimiento (ADR-09) | Diseño · Revisión de código · Manual (RLS con 2 cuentas) |
| RNF-02 | Analítica anónima y sin cookies | `lib/analytics` cookieless, configurada por entorno (ADR-07) | Revisión · Manual |
| RNF-03 | Funcionamiento offline | Service worker + manifest (PWA) | Manual |
| RNF-04 | Carga rápida y uso fluido | SPA estática (Vite), sin servidor | Manual |
| RNF-05 | Interfaz responsive, uso móvil | CSS mobile-first, encabezado compacto | Manual |
| RNF-06 | Integridad de datos académicos | `integrity.test.ts` sobre el registro completo | Automatizada (23 tests) |
| RNF-07 | Escrituras inmutables persistidas al instante | `Store` inmutable + persistencia inmediata | Unit `Store` |
| RNF-08 | Mantenibilidad | TypeScript estricto · dominio puro (ADR-03) | `tsc -b` en CI · Unit |
| RNF-09 | Gate de calidad en CI/CD | `deploy.yml`: lint → unit → e2e → build | Automatizada (pipeline) |
| RNF-10 | Transparencia (proyecto independiente) | Aviso visible en la interfaz | Manual |

## D.5 Resumen de cobertura y brechas

**Cobertura de los 20 RF:**

- **12 con verificación automatizada** (unitaria y/o end-to-end): RF-01, RF-03 a RF-08, RF-10, RF-11, RF-12, RF-15 y RF-16.
- **4 con cobertura parcial:** RF-02 (el e2e cubre la elección de carrera en la bienvenida, no el cambio posterior), RF-13 (las iniciales del avatar tienen test; la carga de foto es manual), y RF-19/RF-20 (la lógica de merge y consentimiento tiene tests unitarios; el flujo OAuth real y el sync entre dispositivos se verifican manualmente — el e2e no puede loguearse en Google).
- **4 con verificación manual:** RF-09, RF-14, RF-17 y RF-18.

**Cobertura de las 12 RN:** 11 verificadas de forma automatizada; RN-11 combina test de persistencia con verificación manual del cambio de plan.

**Brechas conocidas y próximos tests candidatos** (mejoras honestas, no defectos):

1. **RF-09:** un e2e que abra el panel de una materia y verifique los grupos «Necesitás» y «Habilita».
2. **RF-14:** un e2e de ida y vuelta del backup (exportar → reiniciar → importar → verificar estado).
3. **RF-02:** un e2e del cambio de carrera posterior al onboarding, verificando que el progreso de cada plan se conserva (RN-11).

> La matriz se mantiene junto con el código: al agregar un requerimiento o un test, se agrega su fila o su referencia aquí.
