# Plan comercial y workflow de producto — ¿Cuánto me falta?

> Documento de trabajo. **Rev. 8-ago-2026 — giro a B2B.** Reemplaza a la versión de jul-2026,
> que planificaba un freemium B2C antes del B2B.
>
> Versión viva (con bitácora, métricas y diseño técnico):
> https://claude.ai/code/artifact/40183c26-91a0-47ed-ac23-5d9ee92cfc26
>
> **Aclaración:** esto es análisis de producto/estrategia, **no asesoría financiera ni legal**.
> Antes de facturar o firmar algo con una institución, consultar contador y abogado reales.

---

## 0. La tesis en una línea

**El alumno no paga nunca: el cliente es la universidad.** La app queda gratis y sin límites
para el estudiante — es el motor de adopción, y la adopción es exactamente lo que se le vende a
una institución. Sobre eso se construye una **plataforma con perfiles y carga de planes propia**
(el moat: mantener planes al día en cualquier universidad, sin tocar código), y con eso en la
mano se busca **un contrato institucional**: la app con la marca de la facultad, sus planes
mantenidos, y un panel agregado y anónimo de yapa.

**La cuenta que fuerza el giro:** un contrato de USD 6.000/año equivale a 500 estudiantes
pagando USD 1 por mes, todos los meses. Con 47 cuentas y precios argentinos, un freemium al 3%
de conversión daría ~USD 17 al año y, encima, le pondría un peaje a lo único que funciona.

---

## 1. Dónde está el proyecto (al 8-ago-2026)

### 1.1 Lo que hay, en producción

| Área | Estado |
|---|---|
| Stack | Vite + React 19 + TS, dominio POO puro (`Plan`/`Store`/selectors) |
| Deploy | GitHub Actions → GitHub Pages, dominio propio `cuantomefalta.app`, gate de CI |
| Calidad | **179 tests** (166 vitest + 13 e2e), integridad de datos por plan, invariantes geométricos del árbol |
| Datos | **4 carreras** de UADE (152 materias, 89 correlativas), modelo normalizado en `src/data/model.ts` |
| Cuentas | Login con Google (PKCE) + sync multi-dispositivo con Supabase, RLS, consentimiento Ley 25.326 |
| Features | Estados, notas y promedio, correlativas (panel + árbol v2 con modo rama), títulos, PDF, backup, PWA instalable, tour de onboarding |
| Medición | Umami + eventos de embudo (`primera_materia`, `activado`, `dia_activo`, `regreso`, `arbol_rama`, `anio_marcado`) |

### 1.2 Los números que pasaron el Gate A (6-ago-2026)

- **47 cuentas reales** — duplicó desde el 21-jul **sin una sola acción de difusión**.
- **20 activas en 7 días con solo 4 altas nuevas** → ≥16 son cuentas viejas volviendo:
  **retorno estacional demostrado** (arrancó el 2° cuatrimestre y volvieron solas).
- **14 volvieron a editar** otro día (eran 5 el 21-jul).
- **Activación 38%** crudo / ~44% ajustada, con trayectoria **19 → 30 → 38**.
- **Carga por cuenta: 29,3 materias** de promedio; 33 de 45 cargaron 15+.
- **Adquisición: cero.** 23 de 28 "fuentes" son el retorno de OAuth (logins), 3 buscadores.

**Cómo NO medir esta app:** es de uso raro, atado al calendario académico. Las ventanas de 7
días no dicen nada; rebote y duración quedaron contaminados por el fix de la cola del 21-jul (no
comparar a través de esa fecha); la retención se mide **por cohorte y completitud de carga**.

### 1.3 Lo que falta

1. **Canilla.** El producto convierte y retiene; nadie nuevo llega. Es el problema #1 y no se
   arregla con código.
2. **Los planes son código.** Cargar una carrera requiere un archivo TS y un deploy → el moat
   depende de que Luz esté disponible. Es lo que resuelve el Sprint 1.
3. **No hay perfiles.** No existe forma de que un tercero cargue o mantenga datos.
4. **Legales para B2B:** los borradores de privacidad y términos son propios; el panel agregado
   necesita una cláusula explícita, y el contrato necesita abogado.

---

## 2. Modelos de negocio — decisión del 8-ago

| Modelo | Qué es | Ingresos | Veredicto |
|---|---|---|---|
| **Contrato institucional** | Universidad completa: app con su marca + planes mantenidos + panel agregado | USD 5–15k/año | **EL CAMINO** |
| Gratis + donaciones | Cafecito/MP, sin límites ni promesas | Muy bajos | **Se queda** — es el motor de adopción |
| Freemium B2C | Cobrarle al alumno por sync/planner/export | ~USD 17/año a escala actual | **DESCARTADO** — ver §0 |
| Centro de estudiantes | Difusión oficial a cambio de acceso | Cero | **Canal, no cliente** — es la adquisición que falta |
| Planes al día como datos | Licenciar el moat vía API | Medios, recurrentes | **Plan B guardado** — el Sprint 1 lo habilita gratis |
| Sponsors / publicidad display | — | Miseria | **No** |

**La trampa a evitar:** venderle "analítica" a quien ya tiene los datos. La secretaría académica
conoce el avance de sus alumnos mejor que nosotros. Lo que no tiene: **una app que sus alumnos
abren por gusto**, el árbol de correlativas, y los planes al día sin trabajo interno.

---

## 3. Arquitectura del Sprint 1 (backend, perfiles, carga de planes)

`src/data/model.ts` ya está normalizado y mapea 1:1 a tablas → esto es **migración de datos y
permisos**, no rediseño de dominio. Se queda en el mismo proyecto de Supabase.

### 3.1 Tablas

```
datos académicos   universidad · plan (estado borrador|publicado, version) · materia
                   correlativa · titulo
perfiles           perfil (rol: superadmin|admin_uni|estudiante)
                   admin_uni (universidad, crear/editar/eliminar, limite_planes)
                   auditoria (quién, qué, cuándo)
progreso           YA EXISTE — 1 fila JSON por usuario, RLS user_id = auth.uid(), no se toca
```

### 3.2 Permisos

| Acción | Estudiante | Admin de universidad | Superadmin |
|---|---|---|---|
| Ver planes publicados | ✓ | ✓ | ✓ |
| Su propio avance | ✓ | — | — |
| Crear plan | — | ✓ solo su universidad, con permiso y bajo `limite_planes` | ✓ |
| Editar / eliminar plan | — | ✓ ídem | ✓ |
| Publicar borrador | — | ✓ si validó | ✓ |
| Habilitar admins y fijar límites | — | — | ✓ |
| Panel agregado | — | ✓ solo su universidad | ✓ |
| **Avance de UN alumno** | **✕** | **✕** | **✕ no existe la consulta** |

### 3.3 Seis decisiones de diseño

1. **El panel no lee `progreso`** — lee vistas agregadas recalculadas por cron. Si el camino no
   existe, no se puede equivocar. (Descartado: policy de "solo agregando".)
2. **Los planes viajan en el bundle Y se refrescan** — snapshot de arranque + refresco en
   segundo plano con caché en localStorage. (Descartado: fetch bloqueante; rompe el offline.)
3. **Un solo `validarPlan()`** compartido por CI, editor y base: códigos existentes, sin ciclos,
   sin duplicados, correlativa a cuatrimestre anterior, optativas fuera del grafo.
4. **Borrador → validación → publicación**, siempre, con `version` y vuelta atrás. El alumno
   solo ve `publicado`.
5. **Permisos en la base, no en el JWT** — funciones `security definer`; revocar es un `UPDATE`
   (los custom claims quedan cacheados hasta el refresh).
6. **El límite se hace cumplir en la policy** del `INSERT`, no en el formulario, con test propio.

### 3.4 Editor de planes (`/admin`, chunk lazy)

Cinco pantallas: mis planes · estructura (la grilla del alumno, editable) · correlativas con el
**árbol redibujándose en vivo** · títulos · revisar y publicar. Reusa `PlanDef`, `arbolLayout` y
el validador que ya existen.

**Criterio de terminado (= Gate C):** una carrera nueva de ~40 materias y ~25 correlativas
cargada **en menos de 2 horas**, sin código y sin deploy, con los invariantes del árbol en verde
y **cargada por alguien que no sea Luz**, siguiendo el manual. Si no, el moat no existe.

### 3.5 Panel agregado (Fase 4, no ahora)

Penetración por carrera · materias cuello de botella · avance por cohorte · consulta de
correlativas. **Ningún corte con menos de 5 alumnos.** Sin nombres, sin notas individuales, sin
listados exportables, sin cruces con el padrón. Paso legal previo a mostrárselo a un tercero:
decir explícitamente en la política que se publican estadísticas agregadas no identificables.

---

## 4. Workflow por fases (con gates)

### FASE 0 — Endurecer y medir ✅ (6–7 jul)
Tests + CI, integridad de datos, analytics, feedback, SEO/OG, PWA, dominio propio.

### FASE 1 — Validación ✅ (6-jul → 6-ago) · **queda viva la campaña de agosto**
Soft launch, onboarding con tour, árbol v2. **Lo urgente: LinkedIn con UTM en agosto** (ventana
de inscripción; en septiembre vale la mitad).

**🚦 GATE A — ¿Hay tracción? → PASA (6-ago).** Ver §1.2. Decide: campaña de agosto + giro a B2B.

### FASE 2 — Sync + multi-carrera ✅ (12–14 jul, en 3 días)
Supabase, RLS, merge de a tres, consentimiento, 4 carreras, materias compartidas.

**🚦 GATE B — ¿El valor nuevo se usa? → SÍ.** 47 cuentas sin pedirlas, 45 con progreso, los que
vuelven vuelven a *editar*. **Nadie pidió pagar por nada** — media prueba del giro.

### FASE 3 — Plataforma: backend, perfiles y carga de planes ⟵ ARRANCA AHORA
*(reemplaza a la vieja "Fase 3 — Monetización piloto", descartada el 8-ago)*
Agosto 2026, 6–8 sesiones, costo fijo $0. Cuatro pasos, en este orden:

1. **Tablas, migración y loader** (2 sesiones) — las 5 tablas académicas, migración de los 4
   planes, `validarPlan()` extraído, loader con snapshot + refresco.
   *Criterio: los 179 tests verdes leyendo desde la base; la app abre sin red.*
2. **Perfiles, RLS y tests de seguridad** (1–2 sesiones) — con 3 sesiones reales intentando lo
   que no les corresponde, incluido pasar el id de otra universidad a mano.
3. **Editor de planes** (2–3 sesiones) — las 5 pantallas + E2E del camino completo + manual.
4. **Habilitar admins con límite** (1 sesión) — pantalla de superadmin, tests del límite, docs.

**Fuera del sprint a propósito:** panel agregado, white-label, importador de planes, SSO.

**🚦 GATE C — ¿El moat se sostiene sin vos?** La prueba cronometrada de §3.4, con una
universidad **ajena a UADE**. Si no pasa, **no se sale a vender**: prometer "sus planes al día"
sin poder cumplirlo quema la única reunión que se va a conseguir.

### FASE 4 — La venta institucional (oct-2026 →)
Panel agregado · números por carrera con el snapshot de diciembre (finales = el test real de
retención) · pitch de una página + demo con el editor en vivo · entrar por un contacto tibio
(profesor, coordinador, centro de estudiantes) antes que por secretaría académica · abogado,
monotributo y marca en INPI **antes de firmar** · white-label contra firma.

**🚦 GATE D — ¿Hay contrato?** Después de 3 conversaciones institucionales reales: ¿contrato,
carta de intención o piloto pago?
- **Sí** → es una empresa. | **Tibio** ("volvé el año que viene") → es un calendario, no un no.
- **No** → licenciar el moat como datos, o dejarlo como producto gratis que se mantiene solo.
  Lo que NO corresponde es volver a intentar cobrarle al alumno.

**Poner fecha límite y escribirla:** si al 30-jun-2027 no hay carta de intención, plan B.

---

## 5. Métricas

**Del producto:** cuentas con progreso (la métrica madre, de Supabase — no visitantes) ·
activación (≥5 materias; palanca actual = el tour, 78% del embudo) · **retorno estacional**
(activas en una ventana académica menos las altas nuevas) · completitud de carga (predice
retorno: con 15+ materias vuelve el 36%, con 1–4 volvió nadie) · adquisición por `utm_source`
descontando el retorno de OAuth (hoy: cero).

**Para el panel institucional:** penetración por carrera (÷ matrícula estimada — el número que
abre la reunión) · cuello de botella por materia · avance por cohorte · consulta de correlativas.

---

## 6. Costos

| Concepto | Hoy | Antes de firmar | Con contrato |
|---|---|---|---|
| Pages + dominio | ~USD 15/año | ídem | ídem |
| Umami | $0 | $0 | $0–9/mes |
| Supabase | $0 free tier | $0 (las tablas de planes son diminutas) | USD 25/mes (vistas, backups, SLA) |
| Sentry | — | $0 free tier — conviene antes del editor | free o plan chico |
| Abogado | — | revisión de privacidad del panel | contrato + cláusula de datos |
| Contador / monotributo | — | — | antes del primer peso facturado |
| Marca INPI | — | antes de la 1ª reunión seria | — |

**La consecuencia dura del giro:** sin freemium no hay ningún ingreso hasta que una institución
firme. El riesgo financiero sigue siendo casi nulo (~USD 15/año); el riesgo de **tiempo** subió.
Por eso el Sprint 1 se eligió así: es la única parte que vale la pena aunque nadie firme nunca.

---

## 7. Qué NO hacer

- ❌ **Cobrarle al estudiante. Nunca.** Evaluado con números y descartado; sin fecha de revisión.
- ❌ **Prometerle datos nominales de alumnos a una universidad.** Es lo que van a pedir y lo que
  hay que saber negar: sin alumnos no hay producto.
- ❌ **Construir el panel B2B antes de tener con quién hablar.**
- ❌ **Aceptar integración con el sistema de la uni (SIU/Guaraní) o SSO sin contrato** y alcance
  escrito. Es un proyecto, no una feature.
- ❌ **White-label para la demo** (va contra firma) ni **editar planes en vivo** (borrador →
  validación → publicación, siempre).
- ❌ **Cargar carreras nuevas en código** una vez que exista el editor.
- ❌ **Golpear la puerta sin números por carrera** ni con el editor sin andar.
- ❌ **Publicidad display** ni **prometer "datos oficiales"** (el disclaimer de no-afiliación se
  queda).

---

## 8. Esta semana (8–15 ago)

1. **Push** de los commits del árbol y deploy en verde.
2. **🔥 LinkedIn con UTM — hoy** (`?utm_source=linkedin&utm_campaign=ago26`). Es lo único urgente.
3. **Sprint 1, paso 1** con Claude: tablas + migración + `validarPlan()`.
4. **~15-ago:** leer `arbol_rama` y `anio_marcado`.
5. Cambiar el flag `cmf-ev-pwa` → `cmf-ev-pwa2` para volver a medir instalaciones.
6. Elegir la universidad ajena a UADE para la prueba del Gate C.
