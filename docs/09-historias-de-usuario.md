# Anexo C · Historias de usuario y criterios de aceptación

## C.1 Formato y convenciones

Las historias siguen el formato **"Como / quiero / para"** y cada una define sus **criterios de aceptación** en estilo *Gherkin* en español (**Dado / cuando / entonces**), de modo que puedan verificarse de forma objetiva. Se buscó que cumplan INVEST: independientes, negociables, valiosas, estimables, pequeñas y testeables.

Estas historias son la **vista ágil del mismo alcance** definido en los requerimientos funcionales (§2.3): no agregan ni quitan funcionalidad, la expresan desde el valor para el estudiante. Cada historia referencia sus RF, CU y RN; la correspondencia completa —incluida su verificación por tests— está en la **matriz de trazabilidad (Anexo D)**.

## C.2 Épicas

| Épica | Objetivo | Historias |
|---|---|---|
| E1 · Empezar a usar la app | Entrar y quedar operativo en segundos, sin registro | HU-01, HU-02 |
| E2 · Registrar mi avance | Reflejar la situación real de cada materia y ver las métricas | HU-03 a HU-08 |
| E3 · Entender las correlatividades | Consultar el grafo de la carrera en dos niveles de detalle | HU-09, HU-10 |
| E4 · Mis datos, míos | Respaldar, restaurar, exportar y borrar el progreso propio | HU-11 a HU-14 |
| E5 · Una app cómoda | Perfil, ayuda e instalación como app | HU-15 a HU-17 |

## C.3 Épica E1 · Empezar a usar la app

### HU-01 · Ingresar por primera vez

> **Como** estudiante nuevo, **quiero** indicar mi nombre y mi carrera la primera vez que entro, **para** empezar a usar la aplicación de inmediato y sin registrarme.

**Prioridad:** Alta · **Refs:** RF-01, RF-03, RF-16 · CU-01

**Criterios de aceptación**

1. **Dado** que no existe progreso guardado en el dispositivo, **cuando** abro la aplicación, **entonces** veo la pantalla de bienvenida que pide mi nombre y ofrece las carreras disponibles.
2. **Dado** que completo la bienvenida, **cuando** ingreso, **entonces** veo el plan completo organizado por año y cuatrimestre, con todas las materias en «Pendiente» y sin haber creado ninguna cuenta.
3. **Dado** que no cambio la carrera propuesta, **cuando** confirmo, **entonces** se usa el plan por defecto (Ingeniería en Informática).
4. **Dado** que es mi primera visita, **cuando** entro, **entonces** el tutorial se ejecuta una única vez y no vuelve a aparecer por sí solo en visitas posteriores.

### HU-02 · Cambiar de carrera

> **Como** estudiante, **quiero** cambiar de carrera cuando lo necesite, **para** llevar el seguimiento de otro plan sin perder lo que ya cargué.

**Prioridad:** Alta · **Refs:** RF-02 · CU-02 · RN-11

**Criterios de aceptación**

1. **Dado** que estoy usando un plan, **cuando** elijo otra carrera en el selector, **entonces** la aplicación pasa a ese plan con su propio progreso.
2. **Dado** que el plan destino ya tenía progreso guardado, **cuando** cambio, **entonces** ese progreso se muestra intacto: nada se pisa ni se mezcla.
3. **Dado** que el plan destino todavía no tenía perfil, **cuando** cambio, **entonces** mi nombre y mi foto se copian para no tener que cargarlos de nuevo.
4. **Dado** que vuelvo al plan anterior, **cuando** lo selecciono, **entonces** encuentro mi progreso exactamente como estaba.

## C.4 Épica E2 · Registrar mi avance

### HU-03 · Marcar el estado de mis materias

> **Como** estudiante, **quiero** marcar cada materia como pendiente, cursando, pendiente de final o aprobada, **para** que la aplicación refleje mi situación académica real.

**Prioridad:** Alta · **Refs:** RF-04 · CU-03 · RN-01

**Criterios de aceptación**

1. **Dado** el selector de estado de una materia, **cuando** lo abro, **entonces** veo las cuatro opciones con su descripción en primera persona (por ejemplo, «Aprobé la cursada, me falta rendir»).
2. **Dado** que elijo un estado, **cuando** confirmo, **entonces** el cambio se guarda de inmediato en mi dispositivo: cerrar la pestaña no lo pierde.
3. **Dado** un cambio de estado, **cuando** se aplica, **entonces** el porcentaje de avance, los conteos por estado, el avance por año y los hitos de título se actualizan sin recargar la página.
4. **Dado** que cierro el selector sin elegir, **cuando** vuelvo al plan, **entonces** nada cambió.

### HU-04 · Recibir un aviso si no cumplo correlativas

> **Como** estudiante, **quiero** que la aplicación me avise cuando marco una materia sin cumplir sus correlativas, **para** detectar errores de carga o de planificación sin que me bloquee.

**Prioridad:** Alta · **Refs:** RF-05 · CU-03 · RN-02, RN-03, RN-04, RN-05

**Criterios de aceptación**

1. **Dado** una materia común cuyas previas no están al menos en curso, **cuando** la marco como «Cursando» o «Pendiente de final», **entonces** veo un aviso con el detalle exacto de lo que falta (por ejemplo, «Para cursar Programación II te falta: Programación I»).
2. **Dado** una materia cuyas previas no están aprobadas, **cuando** la marco como «Aprobada», **entonces** el aviso aplica la regla de aprobación (previas aprobadas) y lo indica con ese verbo.
3. **Dado** el aviso en pantalla, **cuando** toco «Ver árbol de correlativas», **entonces** se abre el árbol con foco en esa materia.
4. **Dado** el aviso, **cuando** se muestra, **entonces** mi cambio de estado **se mantiene**: la aplicación informa pero no bloquea.
5. **Dado** que la materia es optativa o especial, **cuando** cambio su estado, **entonces** no se muestra ningún aviso.

### HU-05 · Saber qué puedo cursar

> **Como** estudiante, **quiero** ver qué materias tengo disponibles para cursar, **para** planificar el próximo cuatrimestre en segundos.

**Prioridad:** Alta · **Refs:** RF-06 · RN-06

**Criterios de aceptación**

1. **Dado** una materia pendiente cuyas previas están todas al menos en curso, **cuando** miro el plan, **entonces** aparece señalada como disponible.
2. **Dado** una materia sin correlativas, **cuando** empiezo la carrera, **entonces** figura como disponible desde el inicio.
3. **Dado** una materia especial o personalizada, **cuando** consulto las disponibles, **entonces** no se incluye, porque su habilitación no depende de correlativas.
4. **Dado** que cambio el estado de una previa, **cuando** se guarda, **entonces** la disponibilidad se recalcula al instante.

### HU-06 · Ver cuánto me falta

> **Como** estudiante, **quiero** un tablero con mi porcentaje de avance y los hitos de título, **para** responder «¿cuánto me falta?» de un solo vistazo.

**Prioridad:** Alta · **Refs:** RF-11 · RN-07, RN-09

**Criterios de aceptación**

1. **Dado** mi progreso cargado, **cuando** abro la aplicación, **entonces** veo el porcentaje de avance y los conteos por estado actualizados.
2. **Dado** los títulos del plan, **cuando** miro los hitos, **entonces** cada uno indica cuántas materias me faltan aprobar hasta su año correspondiente (por ejemplo, Analista: hasta 3.º).
3. **Dado** que apruebo una materia, **cuando** se guarda el cambio, **entonces** el porcentaje y los hitos lo reflejan de inmediato.
4. **Dado** el avance por año, **cuando** lo consulto, **entonces** veo cuántas materias de cada año están aprobadas.

### HU-07 · Registrar mis notas y conocer mi promedio

> **Como** estudiante, **quiero** cargar la nota de mis finales, **para** conocer mi promedio sin llevar planillas aparte.

**Prioridad:** Media · **Refs:** RF-07, RF-08 · CU-04 · RN-07, RN-08

**Criterios de aceptación**

1. **Dado** el panel de Notas, **cuando** lo abro, **entonces** veo únicamente mis materias aprobadas, agrupadas por año.
2. **Dado** un campo de nota, **cuando** ingreso un valor, **entonces** se guarda como número entero entre 1 y 10, y los valores fuera de rango se ajustan al límite más cercano.
3. **Dado** que hay al menos una nota cargada, **cuando** miro el promedio, **entonces** está calculado solo con las materias aprobadas que tienen nota, y se actualiza al instante.
4. **Dado** que vacío un campo de nota, **cuando** confirmo, **entonces** esa nota se elimina y el promedio se recalcula sin ella.
5. **Dado** que no cargué ninguna nota, **cuando** abro el panel, **entonces** no se muestra un valor de promedio y la aplicación no falla.

### HU-08 · Ponerles nombre a mis optativas

> **Como** estudiante, **quiero** renombrar las materias optativas con la materia que realmente elegí, **para** que mi plan refleje mi cursada verdadera.

**Prioridad:** Media · **Refs:** RF-12 · CU-07 · RN-10

**Criterios de aceptación**

1. **Dado** una materia optativa, **cuando** edito su nombre, **entonces** acepta hasta 48 caracteres y queda guardado.
2. **Dado** un nombre personalizado, **cuando** navego la aplicación, **entonces** ese nombre aparece en el listado, los avisos, el árbol y el resumen.
3. **Dado** que dejo el campo vacío, **cuando** confirmo, **entonces** se restaura el nombre genérico del plan.

## C.5 Épica E3 · Entender las correlatividades

### HU-09 · Consultar las correlativas de una materia

> **Como** estudiante, **quiero** ver qué necesita y qué habilita cada materia, **para** entender su lugar en la carrera sin leer el plan completo.

**Prioridad:** Alta · **Refs:** RF-09 · CU-05

**Criterios de aceptación**

1. **Dado** una materia, **cuando** abro su panel de correlativas, **entonces** veo dos grupos con código de color: «Necesitás» (violeta) y «Habilita» (teal), con sus materias directas.
2. **Dado** un panel abierto, **cuando** abro el de otra materia, **entonces** ambos permanecen abiertos en simultáneo para poder comparar.
3. **Dado** una materia sin correlativas, **cuando** abro su panel, **entonces** se indica que no requiere ni habilita otras materias.

### HU-10 · Explorar el árbol de correlativas

> **Como** estudiante, **quiero** un mapa interactivo de toda la carrera, **para** ver de una vez la cadena completa que arrastra cada materia.

**Prioridad:** Alta · **Refs:** RF-10 · CU-06

**Criterios de aceptación**

1. **Dado** el árbol, **cuando** lo abro desde el tablero, **entonces** veo todas las materias como nodos organizados por año y las correlativas como aristas.
2. **Dado** una materia, **cuando** la pongo en foco, **entonces** se resalta su cadena completa: los prerrequisitos por nivel («necesitás») y todo lo que habilita, también por nivel.
3. **Dado** el aviso de correlativas (HU-04), **cuando** toco su botón, **entonces** el árbol se abre ya enfocado en esa materia.
4. **Dado** el árbol abierto, **cuando** presiono `Escape` o el botón de cierre, **entonces** vuelvo al plan.

## C.6 Épica E4 · Mis datos, míos

### HU-11 · Exportar un backup

> **Como** estudiante, **quiero** descargar un respaldo de todo mi progreso, **para** no depender del navegador donde lo cargué.

**Prioridad:** Alta · **Refs:** RF-14 · CU-09

**Criterios de aceptación**

1. **Dado** el menú Opciones, **cuando** elijo «Exportar backup (.json)», **entonces** se descarga un archivo JSON con todo el progreso del plan activo: estados, notas, nombres de optativas y perfil.
2. **Dado** el archivo exportado, **cuando** lo abro, **entonces** es legible y su nombre deriva de mi perfil (por ejemplo, `plan-uade-luz.json`).

### HU-12 · Restaurar desde un backup

> **Como** estudiante, **quiero** importar un respaldo previo, **para** recuperar mi progreso o llevarlo a otro dispositivo.

**Prioridad:** Alta · **Refs:** RF-14 · CU-10

**Criterios de aceptación**

1. **Dado** un backup válido, **cuando** lo importo desde Opciones, **entonces** el progreso del plan activo se reemplaza por el del archivo y toda la interfaz se actualiza.
2. **Dado** un archivo inválido, **cuando** intento importarlo, **entonces** veo un mensaje de error («No pude leer el archivo…») y mi progreso actual queda intacto.

### HU-13 · Exportar mi resumen en PDF

> **Como** estudiante, **quiero** generar una hoja prolija con mi avance, **para** guardarla o compartirla fuera de la aplicación.

**Prioridad:** Media · **Refs:** RF-15 · CU-11

**Criterios de aceptación**

1. **Dado** el menú Opciones, **cuando** elijo «Exportar resumen (PDF)», **entonces** se abre el diálogo de impresión sobre una vista preparada para papel, con mi identidad, la carrera, las métricas de avance y las materias agrupadas por estado.
2. **Dado** que cambié de carrera, **cuando** exporto el resumen, **entonces** corresponde al plan activo y no a uno fijo.

### HU-14 · Empezar de cero

> **Como** estudiante, **quiero** poder borrar todo mi progreso, **para** reiniciar el seguimiento cuando lo decida.

**Prioridad:** Media · **Refs:** RF-17 · CU-13

**Criterios de aceptación**

1. **Dado** el menú Opciones, **cuando** elijo «Reiniciar», **entonces** se me pide una confirmación explícita antes de borrar nada.
2. **Dado** que confirmo, **cuando** se ejecuta, **entonces** se borra únicamente el progreso del plan activo y la aplicación vuelve a su estado inicial.
3. **Dado** que cancelo, **cuando** se cierra la confirmación, **entonces** no se borra nada.

## C.7 Épica E5 · Una app cómoda

### HU-15 · Tener mi perfil

> **Como** estudiante, **quiero** poner mi nombre y una foto, **para** que la aplicación se sienta mía sin exponer mis datos.

**Prioridad:** Baja · **Refs:** RF-13 · CU-08

**Criterios de aceptación**

1. **Dado** el avatar del encabezado, **cuando** lo toco, **entonces** puedo cambiar mi nombre y cargar una foto, que se procesa y guarda solo en mi dispositivo.
2. **Dado** que no cargué foto, **cuando** se muestra el avatar, **entonces** aparecen las iniciales de mi nombre (hasta dos).

### HU-16 · Repetir el tutorial

> **Como** estudiante, **quiero** volver a ver el recorrido guiado cuando lo necesite, **para** repasar dónde está cada función sin que me interrumpa solo.

**Prioridad:** Media · **Refs:** RF-16 · CU-12

**Criterios de aceptación**

1. **Dado** el menú Opciones, **cuando** elijo «Ver tutorial», **entonces** el recorrido guiado vuelve a ejecutarse sobre la pantalla principal.
2. **Dado** que lo termino o lo cierro, **cuando** sigo usando la aplicación, **entonces** no vuelve a aparecer por sí solo.

### HU-17 · Instalarla y usarla sin conexión

> **Como** estudiante, **quiero** instalar la aplicación en mi teléfono y usarla sin señal, **para** consultar mi avance en cualquier momento, también en la facultad.

**Prioridad:** Media · **Refs:** RF-18, RNF-03 · CU-14

**Criterios de aceptación**

1. **Dado** un navegador compatible, **cuando** uso «Agregar a pantalla de inicio», **entonces** la aplicación queda instalada con su ícono y se abre a pantalla completa, como una app nativa.
2. **Dado** que ya la cargué al menos una vez, **cuando** pierdo la conexión, **entonces** puedo seguir consultando y marcando mi progreso.
