# 2 · Análisis y requerimientos

## 2.1 Contexto y problemática

En UADE (y en la mayoría de las universidades argentinas) el avance en la carrera está regido por un **régimen de correlatividades**: para cursar una materia hay que tener cursadas o aprobadas otras anteriores. Esta estructura convierte al plan de estudios en un **grafo de dependencias**, pero la información oficial se publica en formatos planos (PDF, tablas) que no permiten cruzarla con la situación de cada estudiante.

Las consecuencias observadas que motivaron el proyecto:

1. **Planificación a ciegas.** Elegir qué cursar cada cuatrimestre requiere revisar manualmente qué correlativas se cumplen, materia por materia.
2. **Cuellos de botella invisibles.** Algunas materias habilitan cadenas largas de otras; atrasarlas retrasa media carrera, y eso no es evidente en una tabla.
3. **Seguimiento artesanal.** El estado real ("me falta el final", "la estoy cursando") se lleva en planillas o en la memoria, sin cálculo de avance ni de promedio.
4. **La pregunta sin respuesta rápida:** *¿cuánto me falta?* — para el título intermedio, para el final, en materias y en porcentaje.

## 2.2 Actores

| Actor | Descripción |
|---|---|
| **Estudiante** | Usuario principal. Gestiona su propio progreso en su dispositivo. No requiere registro; con cuenta de Google, además sincroniza. Es el rol por defecto de toda cuenta nueva. |
| **Administrador de universidad** (`admin_uni`) | Carga y mantiene los planes de estudio (materias, correlativas, títulos) de **su** universidad desde la administración (`#admin`), hasta el cupo contratado. No escribe código ni despliega. |
| **Superadministrador** | Da de alta universidades, **habilita y revoca administradores** y fija el cupo de planes de cada universidad. Es lo único que un `admin_uni` no puede hacer (RN-16). |

> Ningún actor —tampoco el superadministrador— puede leer el avance de un estudiante: `progreso` no tiene ninguna relación con las tablas académicas y su regla de acceso es `user_id = auth.uid()` (RN-21, verificado en `supabase/003-verificar-permisos.sql`).

## 2.3 Requerimientos funcionales

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-01 | En la primera visita, la aplicación debe pedir el nombre del estudiante y la carrera, y crear su espacio de progreso local. | Alta |
| RF-02 | El estudiante debe poder cambiar de carrera en cualquier momento; el progreso de cada plan se guarda por separado y no se pisa al cambiar. | Alta |
| RF-03 | La aplicación debe mostrar el plan de estudios completo organizado por año y cuatrimestre. | Alta |
| RF-04 | El estudiante debe poder asignar a cada materia uno de cuatro estados: *pendiente*, *cursando*, *pendiente de final* o *aprobada*. | Alta |
| RF-05 | Al asignar un estado que no cumple las correlativas (según RN-02/RN-03), la aplicación debe mostrar un aviso **no bloqueante** que indique qué materias faltan y ofrezca abrir el árbol de correlativas. | Alta |
| RF-06 | La aplicación debe señalar qué materias están **disponibles para cursar** según el estado actual (RN-06). | Alta |
| RF-07 | El estudiante debe poder cargar, editar y borrar una **nota entera de 1 a 10** por materia. | Media |
| RF-08 | La aplicación debe calcular el **promedio** considerando únicamente materias aprobadas con nota cargada (RN-07), sin romperse si no hay ninguna. | Media |
| RF-09 | Para cada materia debe poder consultarse un **panel de correlativas** con lo que *necesita* y lo que *habilita*; pueden estar abiertos varios paneles a la vez. | Alta |
| RF-10 | La aplicación debe ofrecer un **árbol interactivo de correlativas**: la malla del plan completo (una fila por cuatrimestre, con las correlativas **cortas** dibujadas en reposo — RN-14) y, al seleccionar una materia, un **modo rama** que reacomoda y encuadra su cadena completa — ascendente ("necesitás") y descendente ("habilita") por niveles — desenfocando el resto; salir con un clic afuera o `Escape`. | Alta |
| RF-11 | Un **tablero (dashboard)** debe mostrar: porcentaje de avance, conteos por estado, avance por año y los hitos de título con la cantidad de materias que faltan para cada uno. | Alta |
| RF-12 | Las materias **optativas** deben poder renombrarse por el usuario (hasta 48 caracteres), ya que la oferta se publica cada año y no forma parte del plan. | Media |
| RF-13 | El estudiante debe poder configurar un **perfil local** (nombre y foto); sin foto, el avatar muestra sus iniciales. | Baja |
| RF-14 | La aplicación debe permitir **exportar un backup** del progreso en formato JSON e **importarlo** para restaurarlo (por ejemplo, en otro dispositivo). | Alta |
| RF-15 | La aplicación debe generar un **resumen imprimible** del avance (exportable a PDF mediante el diálogo de impresión del navegador), fiel al plan activo. | Media |
| RF-16 | En la primera visita debe ejecutarse un **tutorial** (coach marks) que recorra las funciones principales; debe poder repetirse a demanda y no volver a aparecer solo. | Media |
| RF-17 | El estudiante debe poder **reiniciar** todos sus datos locales, con confirmación previa. | Media |
| RF-18 | La aplicación debe poder **instalarse como PWA** ("agregar a inicio") y abrirse como una app más del dispositivo. | Media |
| RF-19 | El estudiante debe poder **iniciar sesión con su cuenta de Google** (opcional) para sincronizar su avance; el primer sincronizado requiere **aceptar de forma explícita** los Términos y la Política de Privacidad, y debe poder cerrar sesión en cualquier momento. | Alta |
| RF-20 | Con sesión iniciada, el progreso de **todas las carreras** debe **sincronizarse automáticamente** con la cuenta; al ingresar en otro dispositivo, el avance debe recuperarse, y si ambos lados tienen progreso distinto, la aplicación debe **preguntar cuál conservar** (nunca pisar sin preguntar). | Alta |
| RF-21 | Cada año del plan debe ofrecer un **interruptor** que marque **todas sus materias como aprobadas** de una sola vez y, si el año ya está entero aprobado, las deje **sin marcar**; la acción debe poder **deshacerse** desde el aviso (RN-15). | Alta |
| RF-22 | Cuando se publica una versión nueva del plan que el estudiante tiene abierto, la aplicación debe **avisarle** y dejar que **él decida cuándo actualizar**; nunca cambiar el plan debajo de una sesión en curso (RN-18). | Alta |

### Administración de planes de estudio

Estos requerimientos pertenecen a la administración (`#admin`), que es un módulo aparte: no forma parte de la aplicación del estudiante ni viaja en su bundle.

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-23 | El acceso a la administración debe requerir **sesión iniciada**, y lo que cada cuenta ve debe salir de su **rol y sus habilitaciones**, resueltos contra el servidor: sin permiso no se entra, y sin backend configurado (desarrollo, CI) la pantalla debe decirlo en vez de fallar. | Alta |
| RF-24 | El administrador debe ver la **lista de los planes que administra**, agrupados por universidad, con el **identificador permanente** de cada plan, **qué versión ven los alumnos**, si tiene **cambios sin publicar** y el **cupo** de la universidad (usados, límite y cuántos puede crear todavía). | Alta |
| RF-25 | El administrador debe poder **crear un plan nuevo** dentro del cupo de su universidad; el superadministrador, además, **dar de alta una universidad**. | Alta |
| RF-26 | El administrador debe poder editar la **estructura** del plan (código, nombre, año y cuatrimestre, optativa y especial) **escribiendo sobre la propia grilla**, agregar y borrar materias y años, y **mover** una materia de cuatrimestre; el **código puede dejarse vacío** y se asigna solo. Antes de mover o borrar, la aplicación debe informar **qué correlativas rompe** y a qué materias afecta. | Alta |
| RF-27 | El administrador debe poder marcar las **correlativas sobre el árbol**: elegida una materia y una dirección (*necesita* / *habilita*), la aplicación ilumina las materias conectables y apaga el resto, y cada toque conecta o desconecta. Cuando una materia no se puede conectar, debe poder consultarse **por qué**. | Alta |
| RF-28 | El administrador debe poder definir los **títulos** del plan: nombre y hasta qué año —o qué cuatrimestre— se otorgan (RN-09). | Media |
| RF-29 | Antes de publicar, la aplicación debe mostrar **qué va a cambiar para los alumnos** (comparación contra la versión publicada, redactada en castellano) con **deshacer por cambio** y descartar todo, y los **hallazgos de la validación**: los errores **bloquean** la publicación y los avisos **no** (RN-19). Debe existir además **deshacer** (Ctrl+Z) de las últimas acciones de la sesión de carga. | Alta |
| RF-30 | Publicar debe generar una **versión numerada** con observaciones opcionales, quedar registrada en un **historial** con quién y cuándo, y poder **volverse a una versión anterior** (RN-18). | Alta |
| RF-31 | El superadministrador debe poder **habilitar y revocar** administradores por universidad y **fijar el cupo** de planes de cada una, desde su propia pantalla (RN-16, RN-17). | Alta |
| RF-32 | La administración debe traer su propio **tutorial en contexto**: un recorrido corto para la lista de planes y otro para el editor, cada uno con su marca de visto. | Media |

## 2.4 Requerimientos no funcionales

| ID | Requerimiento | Categoría |
|---|---|---|
| RNF-01 | Por defecto, los datos del estudiante (estados, notas, perfil) se almacenan **en su dispositivo** y no se envían a ningún servidor. Solo si el estudiante **inicia sesión y consiente de forma explícita**, su progreso se guarda además en el servidor de sincronización, protegido por reglas de acceso por fila (solo su cuenta puede leerlo). | Privacidad |
| RNF-02 | La analítica de uso, si está habilitada, debe ser **agregada, anónima y sin cookies** (no requiere banner de consentimiento) y debe poder desactivarse por configuración. | Privacidad |
| RNF-03 | La aplicación debe funcionar **sin conexión** una vez cargada (service worker + PWA). | Disponibilidad |
| RNF-04 | Al ser una SPA estática sin backend, la carga debe ser rápida y el uso, fluido, también en dispositivos móviles de gama media. | Rendimiento |
| RNF-05 | La interfaz debe ser **responsive** y estar optimizada para uso móvil (donde se consulta habitualmente el avance). | Usabilidad |
| RNF-06 | La **integridad de los datos académicos** precargados debe verificarse automáticamente: referencias válidas, sin duplicados y grafo de correlativas sin ciclos (ver §6.3). | Confiabilidad |
| RNF-07 | Las escrituras del estado del usuario deben ser **inmutables y persistirse de inmediato**, de modo que cerrar la pestaña nunca pierda cambios. | Confiabilidad |
| RNF-08 | El código debe ser **mantenible**: TypeScript estricto, lógica de dominio desacoplada de la interfaz y cubierta por tests unitarios. | Mantenibilidad |
| RNF-09 | Ninguna versión debe publicarse sin pasar lint, tests unitarios y tests end-to-end (**gate de calidad** en CI/CD). | Calidad |
| RNF-10 | La aplicación debe declarar de forma visible que es un **proyecto independiente sin afiliación con UADE** y que los datos académicos pueden contener errores. | Transparencia |
| RNF-11 | Toda escritura sobre los datos académicos debe quedar **auditada** (quién, qué tabla, qué acción y sobre qué plan), y el registro debe **sobrevivir al borrado** de la cuenta que lo originó. | Trazabilidad |
| RNF-12 | Los permisos deben resolverse **en la base de datos** (políticas y funciones), no en el cliente ni en el token de sesión: revocar un acceso tiene que tener **efecto inmediato**. La interfaz puede anticipar el permiso para no ofrecer lo imposible, pero **la que decide es la base**. | Seguridad |

## 2.5 Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | Toda materia tiene exactamente un estado: `pendiente`, `cursando`, `final` (cursada aprobada, falta rendir) o `aprobada`. El estado por defecto es `pendiente`. La nota es un dato aparte y opcional. |
| RN-02 | **Para cursar** una materia (pasarla a `cursando` o a `final`), sus correlativas directas deben estar **al menos en curso** (cualquier estado distinto de `pendiente`). |
| RN-03 | **Para aprobar** una materia (rendir su final), sus correlativas directas deben estar **aprobadas**. |
| RN-04 | El incumplimiento de RN-02/RN-03 **no bloquea** el cambio de estado: la aplicación informa (aviso con las materias faltantes y acceso al árbol) pero respeta la decisión del estudiante, que puede tener excepciones o equivalencias que la app no conoce. |
| RN-05 | Las materias **optativas** y las **especiales** (las que se habilitan por requisito de año o porcentaje de carrera, como Práctica Profesional o Proyecto Final) quedan **exentas del chequeo automático** de correlativas. |
| RN-06 | Una materia está **disponible para cursar** si está `pendiente`, no es especial ni personalizada, y todas sus correlativas directas están al menos en curso. Las materias sin correlativas son cursables desde el inicio. |
| RN-07 | El **promedio** se calcula únicamente sobre materias `aprobadas` con nota cargada (promedio sin aplazos). Si no hay ninguna, no se muestra valor. |
| RN-08 | Las **notas** son enteros entre 1 y 10; cualquier valor fuera de rango se ajusta al límite más cercano. |
| RN-09 | Cada plan define sus **títulos** como hitos: un título se alcanza al aprobar **todas** las materias hasta su año correspondiente inclusive (por ejemplo, en Ingeniería en Informática: *Analista* hasta 3.º año, *Ingeniero* hasta 5.º). Si el hito cae a mitad de año, el título indica también el **cuatrimestre** de corte (por ejemplo, en la Lic. en IA: *Técnico* hasta el 1.º cuatrimestre de 3.º). |
| RN-10 | El nombre de una optativa lo define el usuario (RF-12); si no la renombró, se muestra el nombre genérico del plan. |
| RN-11 | El progreso es **independiente por plan**: cambiar de carrera no mezcla ni borra datos de la otra. |
| RN-12 | El progreso solo se almacena en el servidor **con sesión iniciada y consentimiento aceptado** (una vez por cuenta; el registro del consentimiento viaja con los datos). Sin cuenta, todo queda en el dispositivo. Un dispositivo **ya sincronizado no vuelve a preguntar**: la aplicación recuerda la **última sincronización** (base) y adopta sola al lado que avanzó — baja la nube si avanzó la nube, sube lo local si avanzó lo local (por ejemplo, sin conexión). Si avanzaron los dos lados pero en **materias distintas**, la aplicación **fusiona** ambos avances automáticamente (nada se pierde; un borrado no resucita). La pregunta queda para cuando **no se puede saber** cuál es el bueno: la primera vez que la cuenta se usa en un dispositivo con avance previo distinto, o si ambos lados tocaron **la misma materia** con valores distintos — ahí **decide el usuario** entre memoria local y nube. Si quedaron **cambios locales sin subir**, lo local es más nuevo y **prevalece**: un borrado reciente no se restaura desde la cuenta. |
| RN-13 | Las materias **compartidas** (mismo código en dos carreras de la **misma universidad**) reflejan el avance entre carreras: si en una está en curso o aprobada (con su nota), en la otra se muestra igual. Es una **vista derivada** que no contradice a RN-11: cada plan sigue guardando solo sus propias marcas, y una marca explícita del plan activo prevalece sobre lo heredado. Las optativas y las materias personalizadas quedan afuera. |
| RN-14 | En reposo, el árbol dibuja únicamente las correlativas **cortas** (las que separan **uno o dos cuatrimestres**: el 83 % del total). Una correlativa se dibuja **solo si puede rutearse sin cruzar ninguna materia ni pegarse a otra flecha**: las que no encuentran paso limpio, y las largas, se muestran al entrar en modo rama. La malla nunca prioriza mostrar todo por encima de leerse. Además, ni la malla ni el modo rama dibujan las correlativas que **se deducen de otras** (si una materia pide A y B, y B ya pide A, la flecha desde A no agrega información): mostrarlas obliga a rodear la materia del medio y confunde más de lo que aporta. El panel de correlativas de cada materia sí lista todas. |
| RN-15 | El **interruptor de año** marca como aprobadas todas las materias del año **excepto las optativas** (la oferta se elige a mano) y **pisa** los estados que hubiera; si el año ya estaba entero aprobado, las deja **sin marca**. Las **notas no se tocan** nunca. Toda ejecución ofrece **deshacer**, que restituye exactamente el estado previo de cada materia. |
| RN-16 | Hay **tres roles y nada en el medio**: *estudiante* (el rol por defecto de toda cuenta), *administrador de universidad* —que puede **todo** sobre los planes de las universidades en las que está habilitado: crear, editar, publicar y eliminar, hasta el cupo— y *superadministrador*, único que reparte habilitaciones y cupos. Estar habilitado en una universidad es **una sola pregunta**, no un permiso por acción: quien carga un plan es quien lo corrige y quien lo publica. Un `admin_uni` **sin ninguna habilitación no entra**: el rol solo no alcanza. |
| RN-17 | El **cupo de planes es de la universidad**, no de la persona: da el mismo número sin importar qué administrador pregunte. Lo fija el superadministrador y se hace cumplir **en la política de inserción de la base**, no en el formulario; la interfaz solo lo anticipa. Si el cupo se baja por debajo de los planes ya cargados, el disponible es cero, nunca negativo. |
| RN-18 | Las filas de `materia`, `correlativa` y `titulo` son el **borrador**; el estudiante ve únicamente la **foto publicada** (`plan_version`). Publicar guarda una foto nueva y mueve el puntero; **volver atrás mueve el puntero** y no restaura ni borra nada, así el borrador queda donde iba. Mientras se edita, nadie pierde el plan, y quien tenga la app abierta cuando se publica **recibe un aviso y decide cuándo actualizar** (RF-22). |
| RN-19 | Un plan **con errores de validación no se publica** (§6.3); los **avisos no bloquean** —un año salteado o un plan sin títulos pueden ser correctos y quedan para la revisión final—. La misma validación corre en tres lugares: el editor, la publicación en la base y el arranque de la app, que descarta un plan roto antes de dibujarlo. |
| RN-20 | Que un plan tenga **cambios sin publicar** se decide **comparando el contenido** del borrador con el de la foto publicada, con el mismo armador de JSON que produjo la foto — nunca comparando fechas de modificación: cualquier cosa que toque la fila (una migración, un trigger) mueve el reloj sin que haya cambiado un dato. |
| RN-21 | **Ningún rol puede leer el avance de un estudiante.** La tabla `progreso` no tiene ninguna relación con las tablas académicas y su regla de acceso es `user_id = auth.uid()`: no existe consulta que lleve de un plan, una universidad o un padrón al avance de una persona — tampoco para el superadministrador. Lo que la institución puede llegar a ver son agregados anónimos, nunca datos individuales. |

## 2.6 Datos académicos

Los planes viven en el backend y se cargan desde la administración (RF-23 a RF-32). Los cuatro planes originales viajan además en el bundle como **snapshot de arranque** (ADR-11), y están protegidos por tests de integridad automáticos (§6.3).

| Plan | Código | Materias | Correlativas | Optativas | Especiales | Títulos |
|---|---|---|---|---|---|---|
| Ingeniería en Informática (UADE) | 1621 | 52 | 35 | 3 | 2 | Analista en Informática (3.º) · Ingeniero en Informática (5.º) |
| Lic. en Gestión de Tecnología de la Información (UADE) | 13121 | 41 | 20 | 4 | 0 | Licenciado en Gestión de TI (4.º) |
| Tecnicatura Universitaria en Desarrollo de Software (UADE) | 1121 | 20 | 11 | 2 | 0 | Técnico Universitario en Desarrollo de Software (3.º) |
| Lic. en Inteligencia Artificial y Ciencia de Datos (UADE) | 107425 | 39 | 23 | 3 | 0 | Técnico Universitario en Ciencia de Datos (3.º, 1.er cuatrimestre) · Licenciado en IA y Ciencia de Datos (4.º) |

En total: **152 materias** y **89 relaciones de correlatividad** verificadas.
