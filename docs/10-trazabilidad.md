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
| RF-05 | Aviso de correlativas | HU-04 | CU-03 | RN-02 a RN-05 | Unit `Avance` · E2E 3 y 4 |
| RF-06 | Materias disponibles | HU-05 | CU-03 | RN-06 | Unit `Avance` |
| RF-07 | Carga de notas | HU-07 | CU-04 | RN-08 | Unit `Store` · E2E 7 |
| RF-08 | Cálculo de promedio | HU-07 | CU-04 | RN-07 | Unit `Avance` · E2E 6 y 7 |
| RF-09 | Panel de correlativas | HU-09 | CU-05 | — | Manual (base de datos del grafo: Unit `Plan`) |
| RF-10 | Árbol de correlativas (malla + modo rama) | HU-10 | CU-06 | RN-14 | Unit `Plan` + `arbolLayout` (invariantes por plan, por malla y por rama) · E2E 4 y 5 |
| RF-11 | Tablero de avance e hitos | HU-06 | (transversal) | RN-07, RN-09 | Unit `Avance` · E2E 1 y 2 |
| RF-12 | Renombrado de optativas | HU-08 | CU-07 | RN-10 | Unit `Store` |
| RF-13 | Perfil local | HU-15 | CU-08 | — | Unit `Avance` (iniciales) · Manual (foto) |
| RF-14 | Backup: exportar e importar | HU-11, HU-12 | CU-09, CU-10 | — | Manual |
| RF-15 | Resumen imprimible / PDF | HU-13 | CU-11 | — | E2E 10 |
| RF-16 | Tutorial de primera visita | HU-01, HU-16 | CU-01, CU-12 | — | E2E 11 |
| RF-17 | Reinicio de datos | HU-14 | CU-13 | — | Manual |
| RF-18 | Instalación como PWA | HU-17 | CU-14 | — | Manual |
| RF-19 | Login con Google + consentimiento | HU-18 | CU-15, CU-16 | RN-12 | Unit `sync` (consentimiento) · Manual (OAuth real) |
| RF-20 | Sincronización multi-dispositivo | HU-18, HU-19 | CU-15 | RN-12 | Unit `sync` (merge/conteos/ida-y-vuelta) · Manual (2 dispositivos + RLS con 2 cuentas) |
| RF-21 | Interruptor de año (aprobar / desmarcar todo el año) | HU-04 | CU-03 | RN-15 | Unit `Avance` (decidirAnio) + `Store` (setEstados e inverso) · E2E 13 |
| RF-22 | Aviso de versión nueva del plan | HU-20 | CU-25 | RN-18 | Unit `Registro` (comparación estable) · Manual |

**Administración de planes** (§2.3). El *actor* de estas filas es el administrador de universidad, salvo RF-31, que es exclusivo del superadministrador.

| RF | Requerimiento | HU | CU | RN | Verificación |
|---|---|---|---|---|---|
| RF-23 | Acceso a la administración por rol y habilitaciones | HU-21 | CU-17 | RN-16 | Unit `SesionAdmin` (los 5 estados de acceso) · E2E 14 · SQL `003` |
| RF-24 | Lista de planes con versión, cambios sin publicar y cupo | HU-21 | CU-17 | RN-17, RN-20 | Unit `PlanAdmin` + `Cupo` + `RepositorioPlanes` (la consulta) |
| RF-25 | Crear un plan (y una universidad, el superadmin) | HU-22 | CU-18 | RN-17 | Unit `PlanNuevo` + `UniversidadNueva` · SQL (`limite_ok`) |
| RF-26 | Editar la estructura sobre la grilla | HU-22 | CU-19 | RN-19 | Unit `Borrador` (mover avisa qué rompe · quitar limpia los dos sentidos · renombrar arrastra el grafo) |
| RF-27 | Correlativas sobre el árbol | HU-23 | CU-20 | RN-05, RN-19 | Unit `Borrador` (elegibles en los dos sentidos, por qué no se puede conectar) |
| RF-28 | Títulos del plan | HU-22 | CU-21 | RN-09 | Unit `Borrador` · `Validacion` (título a un año inexistente = error) |
| RF-29 | Revisar antes de publicar (qué cambia + validación + deshacer) | HU-24 | CU-22 | RN-19, RN-20 | Unit `Diff` (round-trip: deshacer todo deja el borrador idéntico a lo publicado) + `Validacion` + `Historial` |
| RF-30 | Publicar como versión numerada y volver atrás | HU-24 | CU-22, CU-23 | RN-18 | SQL (`publicar_plan` / `revertir_plan`, con su validación estructural) · Manual |
| RF-31 | Habilitar administradores y fijar cupos | HU-25 | CU-24 | RN-16, RN-17 | Unit `AdminHabilitado` + `Cupo` · SQL `003` (17 chequeos) |
| RF-32 | Tutorial de la administración | HU-21 | CU-17, CU-19 | — | Manual |

## D.3 Reglas de negocio: definición → implementación → verificación

| RN | Regla (resumen) | Dónde se implementa | Cómo se verifica |
|---|---|---|---|
| RN-01 | Cuatro estados por materia | Tipo `Estado` (`types.ts`) · `Store` | Unit `Store` |
| RN-02 | Para cursar: previas al menos en curso | `Avance.previasParaEstado` | Unit `Avance` · E2E 3 |
| RN-03 | Para aprobar: previas aprobadas | `Avance.previasParaEstado` | Unit `Avance` |
| RN-04 | El aviso informa, no bloquea | `StatePopover` + toast con acción | E2E 3 y 4 |
| RN-05 | Optativas y especiales exentas del chequeo | `isSpecial`/`isOpt` (`Plan`) · `StatePopover` | Unit `Avance` · Integridad (optativas sin correlativas) |
| RN-06 | Definición de «disponible» | `Avance.disponible` | Unit `Avance` |
| RN-07 | Promedio solo con aprobadas con nota | `Avance.promedio` | Unit `Avance` · E2E 7 |
| RN-08 | Nota entera entre 1 y 10 | `Store.setNota` (ajuste al rango) | Unit `Store` |
| RN-09 | Títulos como hitos por año (con corte opcional por cuatrimestre) | `Avance.hitos` + `Plan.materiasHasta` (`hastaAnio`/`hastaCuatri`) | Unit `Avance` y `Plan` · Integridad (títulos → años/cuatrimestres válidos) |
| RN-10 | Optativa renombrable, hasta 48 caracteres | `Store.setOptName` | Unit `Store` |
| RN-11 | Progreso independiente por plan | Claves de storage por plan (`src/state`) | Unit `Store` (persistencia) · Manual |
| RN-12 | Server solo con cuenta + consentimiento; dispositivo sincronizado no re-pregunta (base de última sincronización); conflicto real lo decide el usuario; cambios sin subir prevalecen | `lib/sync` (decidirMerge, base/huella, consentimiento, marca dirty) · `state/sync` (gate) · `ConsentModal`/`SyncConflicto` | Unit `sync` · Manual |
| RN-14 | En reposo el árbol dibuja solo las correlativas cortas (1-2 cuatrimestres) y solo si se rutean sin cruzar tarjetas | `lib/arbolLayout` (DIST_CORTA, planearCortas, reduccionTransitiva, invariantes) · `components/Tree/TreeView` (aristas de malla) | Unit `arbolLayout`: invariantes en cero + “las cortas no redundantes y solo esas” + la reducción conserva el alcance + ninguna rama salta de necesitás a habilita, por cada plan |
| RN-15 | El interruptor de año pisa estados, excluye optativas, no toca notas y siempre se puede deshacer | `domain/Avance` (decidirAnio) · `domain/Plan` (codsDelAnio) · `domain/Store` (setEstados → inverso) · `components/PlanView` | Unit `Avance` + `Store` · E2E 13 (marcar → deshacer) |
| RN-13 | Materias compartidas entre carreras (misma universidad): vista derivada, la marca propia prevalece, optativas afuera | `lib/espejo` (espejoDe) · `domain/Store` (vista con espejo) · `state/store` (espejo del plan activo) | Unit `espejo` + `Store` · E2E compartida |
| RN-16 | Tres roles y nada en el medio; estar habilitado en una universidad es una sola pregunta, no un permiso por acción | `SesionAdmin.puedeEn` / `puedeGestionarPermisos` (`lib/admin`) · `supabase/010` y `011` (ADR-14) | Unit `SesionAdmin` · SQL `003` (un admin con el id de otra universidad) |
| RN-17 | El cupo de planes es de la universidad, no del admin; se hace cumplir en la política de inserción | `Cupo` (`lib/admin`, la leyenda para la UI) · `limite_ok()` y la policy de INSERT · `supabase/006` y `007` | Unit `Cupo` (incluido el límite bajado por debajo de lo cargado) · SQL |
| RN-18 | Las filas son el borrador; el alumno ve la foto publicada; volver atrás mueve el puntero | `publicar_plan()` / `revertir_plan()` · vista `plan_publicado` · `plan_version` (ADR-12) | SQL (validación estructural al publicar) · Manual · E2E 15 (el plan que llega del backend) |
| RN-19 | Los errores de validación bloquean la publicación; los avisos no | `Validacion.esPublicable` (`lib/validarPlan`) · el chequeo en `publicar_plan` · el descarte del arranque | Unit `Validacion` (23, con planes roto a propósito) · Integridad (10) |
| RN-20 | «Cambios sin publicar» se decide comparando contenido contra contenido, nunca dos relojes | Vista `plan_editable` con `plan_json` (`supabase/009`) · `PlanAdmin.tieneCambios` (ADR-15) | Unit `PlanAdmin` (regresión con la fila exacta que mentía) |
| RN-21 | Ningún rol puede leer el avance de un estudiante | `progreso` sin FK a las tablas académicas, RLS `user_id = auth.uid()` | SQL `003`: el chequeo que sostiene la promesa del producto (ni el superadmin lo ve) |

## D.4 Requerimientos no funcionales: mecanismo → verificación

| RNF | Requerimiento (resumen) | Mecanismo | Verificación |
|---|---|---|---|
| RNF-01 | Datos en el dispositivo; server solo con cuenta y consentimiento | Local-first (ADR-01) + sync opcional con RLS y gate de consentimiento (ADR-09) | Diseño · Revisión de código · Manual (RLS con 2 cuentas) |
| RNF-02 | Analítica anónima y sin cookies | `lib/analytics` cookieless, configurada por entorno (ADR-07) | Revisión · Manual |
| RNF-03 | Funcionamiento offline | Service worker + manifest (PWA) | Manual |
| RNF-04 | Carga rápida y uso fluido | SPA estática (Vite), sin servidor | Manual |
| RNF-05 | Interfaz responsive, uso móvil | CSS mobile-first, encabezado compacto | Manual |
| RNF-06 | Integridad de datos académicos | `integrity.test.ts` sobre el registro completo | Automatizada (10 tests, §6.3) |
| RNF-07 | Escrituras inmutables persistidas al instante | `Store` inmutable + persistencia inmediata | Unit `Store` |
| RNF-08 | Mantenibilidad | TypeScript estricto · dominio puro (ADR-03) | `tsc -b` en CI · Unit |
| RNF-09 | Gate de calidad en CI/CD | `deploy.yml` en `main` (lint → unit → e2e → build → deploy) y `ci.yml` con el mismo gate en ramas y PRs, sin desplegar | Automatizada (pipeline) |
| RNF-10 | Transparencia (proyecto independiente) | Aviso visible en la interfaz | Manual |
| RNF-11 | Auditoría de las escrituras académicas | Tabla `auditoria` + trigger `auditar()`; `user_id` con `set null` para que el registro sobreviva a la cuenta | SQL · Revisión de código |
| RNF-12 | Los permisos se resuelven en la base, no en el cliente ni en el token | Funciones `security definer` (`mi_rol`, `permiso_uni`, `limite_ok`, `puede_editar_plan`) + políticas RLS; el cliente solo anticipa (ADR-11 pto. 5) | SQL `003` (17 chequeos) · Unit `SesionAdmin` (lo que decide la interfaz) |

## D.5 Resumen de cobertura y brechas

**Cobertura de los 32 RF:**

- **22 con verificación automatizada** (unitaria y/o end-to-end): RF-01, RF-03 a RF-08, RF-10, RF-11, RF-12, RF-15, RF-16, RF-21 y, en la administración, RF-23 a RF-29 y RF-31.
- **6 con cobertura parcial:** RF-02 (el e2e cubre la elección de carrera en la bienvenida, no el cambio posterior), RF-13 (las iniciales del avatar tienen test; la carga de foto es manual), RF-19/RF-20 (la lógica de merge y consentimiento tiene tests unitarios; el flujo OAuth real y el sync entre dispositivos se verifican manualmente — el e2e no puede loguearse en Google), RF-22 (la comparación estable tiene tests; el aviso en pantalla es manual) y RF-30 (la validación estructural al publicar corre en SQL, fuera del pipeline).
- **4 con verificación manual:** RF-09, RF-14, RF-17, RF-18 y RF-32.

**Cobertura de las 21 RN:** 18 verificadas de forma automatizada en el pipeline; RN-11 combina test de persistencia con verificación manual del cambio de plan, y **RN-18 y RN-21 se verifican en SQL** (`supabase/003-verificar-permisos.sql`), fuera de CI (§6.6).

**El límite estructural, dicho de frente:** todo lo que depende de una **sesión real** —el flujo de OAuth, las políticas de RLS respondiendo a un usuario concreto, el I/O de la administración con datos verdaderos— no puede correr en el pipeline, porque CI no tiene con qué loguearse. La mitigación es doble: en el cliente se testea **qué consulta se arma** (con el cliente de Supabase inyectado por constructor), y del lado de la base se corre el script de los 17 chequeos. Lo que queda afuera de las dos redes se verifica a mano, y así está marcado en la matriz.

**Brechas conocidas y próximos tests candidatos** (mejoras honestas, no defectos):

1. **RF-09:** un e2e que abra el panel de una materia y verifique los grupos «Necesitás» y «Habilita».
2. **RF-14:** un e2e de ida y vuelta del backup (exportar → reiniciar → importar → verificar estado).
3. **RF-02:** un e2e del cambio de carrera posterior al onboarding, verificando que el progreso de cada plan se conserva (RN-11).
4. **RF-26 a RF-30:** un e2e del camino completo de la administración (crear un plan → cargar materias → conectar una correlativa → publicar), con las respuestas del backend interceptadas. Hoy cada pieza tiene tests unitarios, pero el recorrido entero se verifica a mano.
5. **Estabilidad:** el e2e del interruptor de año es intermitente en la suite completa (§6.6). Mientras lo sea, no se puede confiar en un rojo del pipeline como señal.

> La matriz se mantiene junto con el código: al agregar un requerimiento o un test, se agrega su fila o su referencia aquí.
