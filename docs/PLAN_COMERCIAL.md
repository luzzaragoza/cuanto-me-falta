# Plan comercial y workflow de producto — ¿Cuánto me falta?

> Documento de trabajo (jul-2026). Análisis del estado del proyecto + hoja de ruta por fases
> para pasar de "app de estudiante" a producto comercializable.
>
> **Aclaración:** esto es análisis de producto/estrategia, **no asesoría financiera ni legal**.
> Antes de facturar o firmar algo con una institución, consultar contador y abogado reales.

---

## 0. La tesis en una línea

**Hoy no tenés un negocio: tenés un excelente prototipo con un solo plan de estudios y cero
usuarios medidos.** El camino a ganar plata no arranca cobrando: arranca **midiendo tracción
gratis en UADE**, después construyendo las dos features que desbloquean valor real (**sync entre
dispositivos** y **multi-carrera**), y recién ahí monetizando en dos frentes: **freemium B2C**
(caja chica, inmediata) y **B2B a instituciones** (caja grande, lenta, necesita datos de uso
como argumento de venta). Vender a UADE sin números de uso es ir a esa reunión con las manos
vacías.

---

## 1. Auditoría del estado actual

### 1.1 Lo que hay (y está bien)

| Área | Estado |
|---|---|
| Stack | Vite + React 19 + TS, dominio POO limpio (`Plan`/`Store`/selectors puros) |
| Deploy | GitHub Actions → GitHub Pages, automático en cada push a `main`. Costo: $0 |
| Features | Estados, notas + promedio, correlativas (panel + árbol React Flow), avisos, perfil, PDF, backup JSON |
| Persistencia | localStorage (`plan-uade-v3`), privacidad total por diseño |
| UX | Pulida, identidad visual propia, español rioplatense, mobile razonable |

**Fortalezas estratégicas:**
- El **dominio está bien modelado**: `Plan` es un grafo genérico — el 80% del código ya es
  agnóstico de UADE. Multi-carrera es un problema de *datos*, no de arquitectura.
- **Costo operativo cero.** Podés validar durante meses sin gastar un peso.
- La **visualización del árbol de correlativas es el diferencial** — ninguna app oficial de
  facultad tiene eso. Es el asset "vendedor" para demos y redes.
- El moat identificado en la visión (mantener **planes y correlativas al día**) es correcto:
  es trabajo aburrido que nadie quiere hacer, y por eso vale.

### 1.2 Lo que falta (debilidades honestas)

**Técnicas, en orden de gravedad:**

1. **Cero tests automatizados.** `package.json` no tiene ni Vitest ni Playwright; el workflow
   deploya sin gate. Hoy un typo en `selectors.ts` llega a producción en 2 minutos.
2. **El plan es código, no datos.** `PLAN` y `CORREL` hardcodeados en TS. Para escalar a otra
   carrera hay que tocar código. Además: **nadie validó automáticamente** que `CORREL` no tenga
   códigos inexistentes o ciclos.
3. **Cero telemetría.** No sabés si la app la usan 3 personas o 300. Sin ese número no se puede
   tomar ninguna decisión de negocio.
4. **Single-device.** localStorage = si el usuario cambia de teléfono, pierde todo (salvo backup
   manual, que nadie hace).
5. **Correlativas unificadas** (cursada vs final sin separar) — fidelidad al reglamento a medias.
6. Sin monitoreo de errores, sin SEO/meta tags/OG, no es PWA instalable.

**De negocio:**

7. **Un solo plan de una sola carrera de una sola facultad.** TAM actual: los alumnos del
   Plan 1621 de Ing. Informática UADE (¿unos cientos?).
8. **Sin canal de feedback** dentro de la app.
9. **Sin landing/pitch**: el README es técnico, no vende.

**Legales (a resolver antes de cobrar):**

10. Sin Términos y Condiciones ni Política de Privacidad (obligatorios al tener cuentas/servidor).
11. Las **notas son datos personales** (Ley 25.326 AR): con backend, corresponde consentimiento,
    y registro de base de datos. Hoy no aplica porque todo queda en el dispositivo — ventaja real.
12. La marca y los planes de UADE: usar los datos del plan como *hechos* está bien; usar
    logo/marca o dar a entender oficialidad, no. El disclaimer actual está bien — mantenerlo.
13. Cuando haya ingresos: monotributo. Si crece: registrar la marca propia (INPI).

---

## 2. Qué mejorar en la app (priorizado)

### P0 — Antes de difundir (1-2 semanas de laburo)

| # | Qué | Por qué |
|---|---|---|
| 1 | **Test de integridad de datos** (CORREL → códigos existentes, sin ciclos, sin huérfanos) | Una correlativa mal cargada rompe la confianza de un usuario para siempre |
| 2 | **Tests unitarios del dominio** (Vitest sobre `selectors`/`Plan`/`Store`) | El dominio es puro → testear es barato y protege lo más crítico (promedio, disponible, previas) |
| 3 | **CI gate**: job de `lint + test` antes del deploy en el workflow | Que no llegue a producción nada roto |
| 4 | **Analytics privacy-friendly** (GoatCounter gratis, o Umami/Plausible) | Sin medición no hay negocio. Sin cookies ni datos personales → sin drama legal |
| 5 | **Botón de feedback** (link a Tally/Google Form) | El feedback de los primeros 20 usuarios vale más que 6 meses de features |
| 6 | **SEO + meta tags + OG image + título decente** | Que compartir el link en WhatsApp muestre una preview linda |
| 7 | **PWA instalable** (manifest + service worker básico) | Los estudiantes viven en el teléfono; "agregar a inicio" = retención |

### P1 — Producto (el cuatrimestre siguiente)

| # | Qué | Por qué |
|---|---|---|
| 8 | **Correlativa de cursada vs de final** | Fidelidad al reglamento real de UADE (ya identificado en el roadmap) |
| 9 | **Planner "¿qué cursar el próximo cuatri?"** — sugerencias usando el grafo (`disponible` + qué materias desbloquean más cadena) | Killer feature. Convierte la app de "registro" a "consejera". Nadie más lo tiene |
| 10 | **Share card**: imagen exportable del avance para stories/estados | Loop de crecimiento orgánico gratis — cada share es publicidad |
| 11 | **Tabla completa de notas** (P1/P2/recus/promoción, ya planificada en CLAUDE.md §4) | Profundidad para usuarios intensivos |
| 12 | **Import por copy-paste** desde la pantalla de notas de UADE (parser) | Mata la fricción del onboarding (cargar 30 materias a mano espanta) |

### P2 — Escala (solo si el Gate A pasa, ver §6)

| # | Qué | Por qué |
|---|---|---|
| 13 | **Planes como datos**: JSON por carrera + validador + loader | Multi-carrera/multi-facultad sin tocar código |
| 14 | **Backend Supabase**: auth + sync; localStorage queda como modo offline | Multi-device + la base para todo lo B2B |
| 15 | **Editor de planes** (interno primero) | El moat: mantener planes al día a costo bajo |
| 16 | **Panel B2B**: analytics agregada y anónima (materias cuello de botella, avance por cohorte) | El producto que se le vende a instituciones |

---

## 3. ¿Tengo que testear? Sí — así

1. **Unit (Vitest)** — `src/domain/` es funciones puras: `promedio`, `disponible`,
   `previasParaEstado`, `chainUp/Down`, hitos. Son el corazón del producto y se testean en horas.
   Agregar: `npm i -D vitest` + `"test": "vitest run"`.
2. **Integridad de datos** — un test que recorra `CORREL` y `PLAN`: todo código referenciado
   existe, no hay ciclos en el grafo, no hay materias duplicadas. Corre en CI; es el seguro de
   calidad del moat (cuando haya 10 planes cargados, esto es lo que te deja dormir).
3. **E2E (Playwright)** — formalizar los scripts que ya usamos en desarrollo (marcar estados,
   toast de previas, drawer de notas, árbol). 5-6 flujos críticos, no más.
4. **CI**: en `deploy.yml`, agregar `npm run lint && npm test` como paso previo al build.
   Si falla, no se deploya.
5. **Beta humana**: 10-20 compañeros reales usando la app 2 semanas + form de feedback.
   Esto también es "testing" y es el más valioso ahora.

---

## 4. ¿Cómo "subo la app al server"?

**Hoy ya estás en producción.** GitHub Pages *es* el server para lo que la app es ahora
(estática, datos en el dispositivo). No hay que migrar nada para lanzar y difundir.

**Lo único que vale la pena ya:** un **dominio propio** (~USD 10-15/año), p.ej.
`cuantomefalta.app`. GitHub Pages soporta dominio custom con HTTPS gratis. Un dominio propio
da seriedad para compartir y desacopla la marca de tu usuario de GitHub.

**Cuándo sí hace falta backend** (Fase 2, §6): cuando quieras cuentas y sync. Ahí:

- **Supabase** (recomendado, ya estaba en la visión): Postgres + auth + API sin servidor propio.
  Free tier alcanza para validar; Pro es USD 25/mes cuando escale.
- La SPA sigue igual donde está; solo le agregás el cliente de Supabase. El `Store` observable
  que ya tenés es el lugar perfecto para enchufar sync (localStorage = caché offline).
- Implica: modelo de datos (users, progreso, notas), **Row Level Security** (cada usuario ve
  solo lo suyo), flujo de migración "subí tu progreso local a tu cuenta", y ahí sí ToS +
  política de privacidad + consentimiento (las notas pasan a estar en tu servidor).

**Errores en producción:** Sentry free tier cuando haya usuarios de verdad.

---

## 5. Modelos de negocio — análisis comparado

| Modelo | Qué es | Ingresos | Esfuerzo | Riesgo | Veredicto |
|---|---|---|---|---|---|
| **Gratis + donaciones** | Cafecito/MP en la app | Muy bajos | Trivial | Ninguno | Hacerlo ya, pero no es un negocio |
| **Freemium B2C** | Gratis lo core; pago: sync, planner, export pro (~USD 1-2/mes o pago único) | Bajos-medios | Medio (requiere backend) | Estudiantes AR pagan poco; lo core debe seguir gratis | **Sí, en Fase 3** — valida que *alguien* paga |
| **B2B instituciones** | White-label + panel de analytics a facultades privadas | Altos (miles USD/año por contrato) | Alto | Ciclo de venta larguísimo; sin tracción no te atienden | **El premio final** — solo con datos de uso en mano |
| **B2B2C centros de estudiantes** | El centro paga/esponsorea el acceso de sus alumnos | Medios | Medio | Depende de política interna | Buen caballo de Troya para entrar a una facu |
| **Sponsors segmentados** | Institutos de inglés, bootcamps, editoriales — placement discreto | Bajos-medios | Bajo | Enchastra la UX si te pasás | Aceptable como puente, con límites duros |
| **Publicidad display** | AdSense etc. | Miseria con este volumen | Bajo | Destruye la estética que es tu diferencial | **No** |

**Recomendación (secuencia, no elección):**
1. **Ahora:** gratis, sin límites, + donaciones. Objetivo = usuarios y datos, no plata.
2. **Con tracción:** freemium — el free sigue siendo mejor que nada en el mercado; lo premium
   es *conveniencia* (sync, planner, import), nunca el core.
3. **Con números:** B2B. A la reunión con una facultad se llega diciendo *"el 40% de sus
   alumnos de informática ya la usa por su cuenta"*. Eso invierte la relación de fuerzas.

**Bonus no monetario que ya estás cobrando:** este proyecto como portfolio vale entrevistas
y laburo. Eso también es plata; no lo subestimes al decidir cuánto invertirle.

---

## 6. Workflow por fases (con gates de revisión)

Cada fase termina en un **GATE**: un checkpoint donde se mide, se revisa y se decide
**seguir / ajustar / frenar**. Esto es lo que evita gastar 6 meses construyendo algo que
nadie pidió.

### FASE 0 — Endurecer y medir (2-3 semanas)
- P0 completo (§2): tests + CI, integridad de datos, analytics, feedback, SEO/OG, PWA.
- Dominio propio.
- Landing mínima (puede ser la misma app con mejor meta/onboarding).

### FASE 1 — Validación en UADE (4-8 semanas)
- Soft launch: 10-20 conocidos → iterar con su feedback → launch amplio.
- Canales: grupos de WhatsApp de cursada, centro de estudiantes, Instagram/TikTok con un
  video de 30s del árbol de correlativas (es visualmente vendedor), boca a boca.
- Publicar 1-2 mejoras visibles por semana durante el push (momentum percibido).

**🚦 GATE A:** ¿≥100 usuarios activos/mes y ≥30% vuelve a las 4 semanas? ¿Piden features?
- **Sí** → Fase 2. | **Tibio** → iterar producto con el feedback, re-medir en 4 semanas.
- **No** → problema de producto o de mercado; NO construir backend. Revisar y pivotear
  (¿otra carrera? ¿otro dolor?).

### FASE 2 — Sync + multi-carrera (1-2 meses de laburo real)
- Supabase (auth + sync, RLS), migración desde localStorage.
- Planes como datos + validador; cargar 2-3 carreras más de UADE (mismo edificio, cero
  marketing extra).
- ToS + Política de Privacidad + consentimiento.
- Features P1 que el feedback haya priorizado (planner y share card son mis apuestas).

**🚦 GATE B:** ¿Los usuarios crean cuenta? ¿Usan sync? ¿Llegan usuarios de las carreras
nuevas solos? ¿Alguien pidió pagar por algo?
- **Sí** → Fase 3. | **No** → el valor percibido está en otro lado; volver al feedback.

### FASE 3 — Monetización piloto (1 mes)
- Freemium: 1-2 features premium (sync multi-device, planner avanzado). Precio bajo, pago
  por MP/tarjeta. Medir conversión, no ingresos.
- En paralelo: 1 conversación exploratoria con un centro de estudiantes (B2B2C piloto,
  aunque sea gratis a cambio de difusión oficial).
- Monotributo antes del primer peso facturado.

**🚦 GATE C:** ¿≥2-3% de usuarios activos convierte a pago, o hay un piloto institucional
firmado?
- **Sí** → Fase 4. | **No** → freemium mal calibrado (mover qué es premium) o el mercado
  B2C no paga → foco 100% B2B.

### FASE 4 — Escala B2B
- Editor de planes + proceso de actualización por cuatrimestre (el moat operativo).
- Panel de analytics agregada/anónima (el producto institucional).
- Pitch a facultades privadas chicas primero (deciden rápido), UADE después con números.
- Acá sí: abogado para contratos, revisión seria de datos personales, y evaluar si esto
  es un emprendimiento de verdad o un side-project rentable — ambas son victorias.

---

## 7. Métricas que importan (mirar semanalmente desde Fase 1)

- **Usuarios activos** (semana/mes) — la métrica madre.
- **Activación:** % de visitantes que carga ≥5 materias (si no llegan ahí, el onboarding falla
  → prioriza el import por copy-paste).
- **Retención a 4 semanas** — la app es de uso cuatrimestral; retención = producto vivo.
- **Shares** (PDF exportados, share cards) — proxy del loop viral.
- **Feedback cualitativo:** qué piden, de qué se quejan, qué carrera preguntan.

---

## 8. Costos estimados

| Concepto | Hoy | Fase 2+ |
|---|---|---|
| Hosting (Pages) | $0 | $0 |
| Dominio | — | ~USD 10-15/año |
| Analytics | $0 (GoatCounter) | $0-9/mes |
| Supabase | — | $0 (free) → USD 25/mes |
| Sentry | — | $0 (free tier) |
| Contador/monotributo | — | Solo al facturar |
| **Total para validar** | **~USD 15/año** | |

El riesgo financiero es prácticamente nulo. El costo real es tu tiempo — por eso los gates:
para no regalar cuatrimestres a algo que los datos no acompañan.

---

## 9. Qué NO hacer (por ahora)

- ❌ Construir backend antes del Gate A (es el error clásico).
- ❌ Ir a golpear la puerta de UADE sin números de uso.
- ❌ Cobrar por lo que hoy es gratis (mata la tracción; premium = cosas *nuevas*).
- ❌ Publicidad display.
- ❌ Sumar carreras a mano antes de tener planes-como-datos (deuda que después se paga cara).
- ❌ Prometer "datos oficiales" — el disclaimer de no-afiliación se queda.

---

## 10. Próximos 5 pasos concretos (esta semana)

1. Vitest + tests de `domain/` + test de integridad de `CORREL`/`PLAN`.
2. Gate de `lint + test` en `deploy.yml`.
3. Analytics (GoatCounter) + botón de feedback (Tally).
4. Meta tags + OG image + manifest PWA.
5. Comprar dominio y apuntarlo a Pages.

Con eso, la app queda lista para el soft launch de Fase 1.
