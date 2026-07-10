# Anexo B · Glosario

## Términos académicos

| Término | Definición |
|---|---|
| **Plan de estudios** | Conjunto ordenado de materias, correlatividades y títulos que define una carrera en una versión concreta (ej.: Plan 1621 de Ingeniería en Informática, UADE, vigente desde 2021). |
| **Materia** | Asignatura del plan, identificada por un código (ej. `3.4.069`), ubicada en un año y cuatrimestre. |
| **Cuatrimestre ("cuatri")** | Período lectivo de medio año académico. Cada año del plan tiene dos. |
| **Correlativa** | Materia que se exige antes de otra. "A es correlativa de B" significa que para cursar B hay que tener A (al menos cursada; para rendir el final de B, aprobada). |
| **Régimen de correlatividades** | El conjunto de todas las relaciones de correlatividad de un plan; forma un grafo dirigido acíclico. |
| **Cursada** | La instancia de cursar una materia. "Aprobar la cursada" habilita a rendir el final. |
| **Final** | Examen final de una materia. En la aplicación, el estado *pendiente de final* significa cursada aprobada, final pendiente. |
| **Promedio (sin aplazos)** | Promedio de las notas de finales aprobados. La aplicación lo calcula solo con las materias aprobadas que tienen nota cargada. |
| **Optativa** | Materia de libre elección. La oferta se publica cada año y no forma parte del plan, por eso en la aplicación son "slots" renombrables. |
| **Materia especial** | Materia que no se habilita por correlativas sino por otro requisito (año alcanzado o porcentaje de la carrera), como la Práctica Profesional o el Proyecto Final. |
| **Título intermedio** | Título que se obtiene al completar los primeros años de una carrera (ej.: *Analista en Informática* al aprobar todo hasta 3.º año). |
| **UADE** | Universidad Argentina de la Empresa. |

## Términos del producto

| Término | Definición |
|---|---|
| **Estado de una materia** | Situación del estudiante respecto de esa materia: `pendiente`, `cursando`, `pendiente de final` o `aprobada`. |
| **Disponible** | Materia pendiente que ya se puede cursar: todas sus correlativas directas están al menos en curso. |
| **Necesitás / Habilita** | Las dos direcciones del grafo desde una materia: sus prerrequisitos (violeta) y todo lo que destraba (teal). |
| **Árbol de correlativas** | Vista de grafo interactiva del plan completo, con foco por materia y cadenas resaltadas por nivel. |
| **Hito** | Cada título del plan mostrado en el tablero, con la cantidad de materias que faltan para alcanzarlo. |
| **Backup** | Archivo JSON con todo el progreso local, exportable e importable por el usuario. |

## Términos técnicos

| Término | Definición |
|---|---|
| **SPA** (*single-page application*) | Aplicación web que carga una sola página y actualiza la interfaz sin recargar. |
| **PWA** (*progressive web app*) | Aplicación web instalable en el dispositivo, con ícono propio y funcionamiento offline mediante un service worker. |
| **Local-first** | Enfoque en el que los datos del usuario viven primero (y en este caso, únicamente) en su dispositivo. |
| **`localStorage`** | Almacenamiento clave-valor persistente del navegador, ámbito por sitio. |
| **Service worker** | Script del navegador que intercepta las peticiones de red y permite servir la aplicación sin conexión. |
| **Grafo dirigido acíclico (DAG)** | Estructura de nodos y flechas sin ciclos; es la forma matemática del régimen de correlatividades. |
| **BFS** (*breadth-first search*) | Recorrido de un grafo por niveles; la aplicación lo usa para calcular a cuántos "pasos" está cada materia de otra en el árbol. |
| **Store observable** | Objeto que mantiene estado y notifica a sus suscriptores en cada cambio; la interfaz se re-renderiza al recibir la notificación. |
| **Inmutabilidad** | Práctica de no modificar el estado existente sino crear una copia nueva con el cambio aplicado; permite detectar cambios comparando referencias. |
| **Design tokens** | Variables con los valores de diseño (colores, tipografías) definidas una sola vez y usadas en toda la interfaz. |
| **CI/CD** | Integración y despliegue continuos: cada cambio se verifica (tests) y publica automáticamente. |
| **Gate de calidad** | Regla del pipeline por la cual una versión no se publica si falla alguna verificación. |
| **Test end-to-end (e2e)** | Prueba automatizada que ejercita la aplicación completa en un navegador real, como lo haría un usuario. |
