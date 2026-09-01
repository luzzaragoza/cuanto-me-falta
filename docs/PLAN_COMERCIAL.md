# Plan comercial y workflow de producto — ¿Cuánto me falta?

> Documento de trabajo. **Rev. 1-sep-2026 — el Sprint 1 está en producción.** La estrategia
> es la misma del giro a B2B del 8-ago; lo que cambió es que la plataforma dejó de ser un
> plan y pasó a ser algo que funciona.
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

## 1. Dónde está el proyecto (al 1-sep-2026)

### 1.1 Lo que hay, en producción

| Área | Estado |
|---|---|
| Stack | Vite + React 19 + TS, dominio POO puro (41 clases; ver ADR-13) |
| Deploy | GitHub Actions → GitHub Pages, dominio propio `cuantomefalta.app`, gate de CI en `main` **y en ramas** |
| Calidad | **319 tests** (304 vitest + 15 e2e), integridad de datos por plan, invariantes geométricos del árbol |
| Datos | **4 carreras** de UADE (152 materias, 89 correlativas), **en tablas del backend**, con el bundle como snapshot de arranque |
| **Plataforma** | **La administración de planes, funcionando** (`#admin`): tres roles, cupo por universidad, carga sobre la grilla, correlativas sobre el árbol, validación, publicación por versiones y vuelta atrás. **11 migraciones corridas.** Cargar una carrera ya no necesita código ni deploy |
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

1. **Canilla.** El producto convierte y retiene; nadie nuevo llega. Sigue siendo el problema
   #1, sigue sin arreglarse con código, y **la ventana de agosto ya se fue**: el LinkedIn con
   UTM estaba escrito y aprobado desde el 6-ago y no se publicó. En septiembre vale menos, pero
   vale; el próximo momento con demanda natural es diciembre (finales).
2. **El Gate C, que es la prueba del moat.** La plataforma existe, pero todavía **no la usó
   nadie que no sea Luz**. Hasta que una persona ajena cargue una carrera de una universidad
   ajena en menos de dos horas siguiendo un manual, "mantenemos sus planes al día" es una
   promesa sin evidencia. Falta el manual y falta correr la prueba.
3. **El rediseño visual en curso.** Colores y árbol de correlativas están siendo rediseñados;
   hasta que eso cierre, la pestaña de correlativas del editor y todo lo visual quedan
   congelados. Es lo que hoy bloquea al punto 2, porque el manual no se escribe sobre un
   blanco móvil.
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
| Planes al día como datos | Licenciar el moat vía API | Medios, recurrentes | **Plan B guardado** — la plataforma ya lo habilita gratis |
| Sponsors / publicidad display | — | Miseria | **No** |

**La trampa a evitar:** venderle "analítica" a quien ya tiene los datos. La secretaría académica
conoce el avance de sus alumnos mejor que nosotros. Lo que no tiene: **una app que sus alumnos
abren por gusto**, el árbol de correlativas, y los planes al día sin trabajo interno.

---

## 3. Arquitectura de la plataforma (construida)

`src/data/model.ts` ya estaba normalizado y mapeaba 1:1 a tablas → esto fue **migración de datos
y permisos**, no rediseño de dominio. Quedó en el mismo proyecto de Supabase.

### 3.1 Tablas

```
datos académicos   universidad (nombre, activa, limite_planes) · plan (estado, version_publicada)
                   materia · correlativa · titulo · plan_version (la foto publicada, JSON)
perfiles           perfil (rol: superadmin|admin_uni|estudiante)
                   admin_uni (quién administra qué universidad — y nada más)
                   auditoria (quién, qué, cuándo)
progreso           YA EXISTÍA — 1 fila JSON por usuario, RLS user_id = auth.uid(), no se tocó
```

Dos correcciones que salieron de auditar el esquema con el editor ya escrito: **el cupo es de
la universidad, no del admin** (cuando vivía en `admin_uni`, con dos admins de límites distintos
el cupo real dependía de quién apretaba el botón), y **las columnas de permiso por acción se
borraron** — ver §3.2. Las dos se aplicaron *expandiendo y contrayendo*, sin cortar el servicio.

### 3.2 Permisos — tres roles y nada en el medio

La versión de agosto tenía un permiso por acción (`crear`/`editar`/`eliminar`). Se eliminó: en
la práctica **quien carga un plan es quien lo corrige y quien lo publica**, y lo único que
lograban las tres casillas era habilitar a alguien *a medias por error*.

| Acción | Estudiante | Admin de universidad | Superadmin |
|---|---|---|---|
| Ver planes publicados | ✓ | ✓ | ✓ |
| Su propio avance | ✓ | — | — |
| Crear plan | — | ✓ en SU universidad, bajo el cupo de esa universidad | ✓ |
| Editar / eliminar / publicar | — | ✓ ídem — es **una** habilitación, no tres | ✓ |
| Habilitar admins y fijar cupos | — | — | ✓ |
| Panel agregado *(Fase 4)* | — | ✓ solo su universidad | ✓ |
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

### 3.4 Editor de planes (`#admin`, chunk lazy) — construido

Cinco pantallas: mis planes · estructura (la grilla del alumno, editable) · correlativas
**marcadas sobre el árbol** · títulos · revisar y publicar. Reusa `PlanDef`, `arbolLayout` y el
validador que ya existían. Más un panel aparte para el superadmin (permisos y cupos) y dos
tutoriales cortos en contexto.

Lo que enseñó ponerlo en manos de alguien: la primera versión eran **formularios**, y fracasó
por completo —"ni yo entiendo bien cómo ni qué hacer"—. La idea que lo salvó fue de Luz:
**cargar las correlativas tocando el árbol**, eligiendo primero la dirección. Reusa el lenguaje
de color que el usuario ya aprendió y hace imposible dibujar una flecha inválida. Segunda
lección, más cara: **verificar una pantalla de lista con datos de juguete no verifica nada** —
el defecto era de escala y con 8 materias no existía.

**Criterio de terminado (= Gate C, todavía pendiente):** una carrera nueva de ~40 materias y
~25 correlativas cargada **en menos de 2 horas**, sin código y sin deploy, con los invariantes
del árbol en verde y **cargada por alguien que no sea Luz**, siguiendo el manual. Si no, el moat
no existe. Falta escribir el manual —a propósito: no se documenta un blanco móvil— y falta
correr la prueba.

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

### FASE 3 — Plataforma: backend, perfiles y carga de planes ✅ (8-ago → 29-ago)
*(reemplazó a la vieja "Fase 3 — Monetización piloto", descartada el 8-ago)*
Agosto 2026, costo fijo $0. Los cuatro pasos, hechos y en producción:

1. ✅ **Tablas, migración y loader** — las 5 tablas académicas, los 4 planes migrados,
   `validarPlan()` extraído y compartido por CI, editor y arranque, loader con snapshot +
   refresco. *La app sigue abriendo sin red y sin backend.*
2. ✅ **Perfiles, RLS y tests de seguridad** — 17 chequeos con sesiones reales intentando lo que
   no les corresponde, incluido pasar el id de otra universidad a mano. Corre en SQL, fuera de
   CI: es el precio de probar permisos de verdad.
3. ✅ **Editor de planes** — rediseñado entero después del primer intento fallido (§3.4).
4. ✅ **Habilitar admins con cupo** — panel del superadmin, y el modelo de permisos simplificado
   a tres roles (§3.2).

**Fuera de la fase a propósito, y sigue afuera:** panel agregado, white-label, importador de
planes, SSO.

**Lo que queda de deuda, dicho sin maquillaje:** el manual de carga, el Gate C, el rediseño
visual en curso, y un test intermitente que bloquea merges al azar.

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
Por eso la plataforma se eligió así: es la única parte que vale la pena aunque nadie firme nunca.
Ese criterio ya se cobró: está construida, y sirve para mantener los planes de UADE al día
aunque ninguna institución firme jamás.

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

## 8. Lo próximo (septiembre)

Con la plataforma en producción, el orden lo manda una sola pregunta: **¿qué hace falta para
poder mostrarla?**

1. **🔥 El LinkedIn con UTM.** Está escrito y aprobado desde el 6-ago y sigue sin publicarse
   (`?utm_source=linkedin&utm_campaign=sep26`). La adquisición sigue en **cero** y es el único
   número que no mejora solo. La ventana de inscripción ya pasó: publicarlo igual, y volver a
   empujar en diciembre.
2. **Cerrar el rediseño visual** (colores + árbol de correlativas). Es lo que hoy bloquea el
   manual, y por lo tanto el Gate C.
3. **Manual de carga + 🚦 Gate C**, en ese orden y con la universidad ajena ya elegida. Es la
   prueba de fuego del moat: si no pasa, no se sale a vender.
4. **Arreglar el test intermitente** del interruptor de año: falla ~1 de cada 3 corridas
   completas. Un rojo que a veces miente enseña a ignorar los rojos.
5. **Deuda chica que sigue abierta:** el flag `cmf-ev-pwa` → `cmf-ev-pwa2` para volver a medir
   instalaciones, y dos planes cuya foto avisa "cambios sin publicar" de más (el lado seguro
   del error, ya diagnosticado).
6. **Diciembre 2026** es el próximo test real de retención (finales) — y el número de cohorte
   que se lleva a la primera reunión institucional.
