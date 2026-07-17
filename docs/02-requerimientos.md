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
| **Estudiante** | Usuario principal y único de la versión actual. Gestiona su propio progreso en su dispositivo. No requiere registro. |
| **Mantenedora del proyecto** | Carga y cura los planes de estudio (materias, correlativas, títulos) en el repositorio. No interactúa por la UI: los datos académicos son parte del código y están protegidos por tests de integridad. |

> En la evolución futura del proyecto (ver §4.11) se prevé un actor **Administrador** con interfaz propia para cargar planes; en la versión actual ese rol se ejerce por código.

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
| RF-10 | La aplicación debe ofrecer un **árbol interactivo de correlativas** del plan completo, con foco por materia y visualización por niveles de toda la cadena ascendente ("necesitás") y descendente ("habilita"). | Alta |
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
| RN-12 | El progreso solo se almacena en el servidor **con sesión iniciada y consentimiento aceptado** (una vez por cuenta; el registro del consentimiento viaja con los datos). Sin cuenta, todo queda en el dispositivo. Un dispositivo **ya sincronizado no vuelve a preguntar**: la aplicación recuerda la **última sincronización** (base) y adopta sola al lado que avanzó — baja la nube si avanzó la nube, sube lo local si avanzó lo local (por ejemplo, sin conexión). La pregunta queda para cuando **no se puede saber** cuál es el bueno: la primera vez que la cuenta se usa en un dispositivo con avance previo distinto, o si ambos lados avanzaron a la vez — ahí **decide el usuario** entre memoria local y nube. Si quedaron **cambios locales sin subir**, lo local es más nuevo y **prevalece**: un borrado reciente no se restaura desde la cuenta. |
| RN-13 | Las materias **compartidas** (mismo código en dos carreras de la **misma universidad**) reflejan el avance entre carreras: si en una está en curso o aprobada (con su nota), en la otra se muestra igual. Es una **vista derivada** que no contradice a RN-11: cada plan sigue guardando solo sus propias marcas, y una marca explícita del plan activo prevalece sobre lo heredado. Las optativas y las materias personalizadas quedan afuera. |

## 2.6 Datos académicos precargados

Los planes se cargan curados en el repositorio y están protegidos por tests de integridad automáticos (§6.3).

| Plan | Código | Materias | Correlativas | Optativas | Especiales | Títulos |
|---|---|---|---|---|---|---|
| Ingeniería en Informática (UADE) | 1621 | 52 | 35 | 3 | 2 | Analista en Informática (3.º) · Ingeniero en Informática (5.º) |
| Lic. en Gestión de Tecnología de la Información (UADE) | 13121 | 41 | 20 | 4 | 0 | Licenciado en Gestión de TI (4.º) |
| Tecnicatura Universitaria en Desarrollo de Software (UADE) | 1121 | 20 | 11 | 2 | 0 | Técnico Universitario en Desarrollo de Software (3.º) |
| Lic. en Inteligencia Artificial y Ciencia de Datos (UADE) | 107425 | 39 | 23 | 3 | 0 | Técnico Universitario en Ciencia de Datos (3.º, 1.er cuatrimestre) · Licenciado en IA y Ciencia de Datos (4.º) |

En total: **152 materias** y **89 relaciones de correlatividad** verificadas.
