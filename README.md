# ¿Cuánto me falta?

Seguimiento interactivo de la carrera **Ingeniería en Informática (UADE — Plan 1621)**.
Marcá el estado de cada materia, mirá las correlativas y tu avance de un vistazo.

> ℹ️ **Versión nueva en camino:** la app se está reescribiendo con **Vite + React + TypeScript**
> (con [React Flow](https://reactflow.dev/) para el árbol de correlativas) para ordenar el código
> y hacerla más interactiva. El trabajo vive en la rama
> [`react-migration`](https://github.com/luzzaragoza/cuanto-me-falta/tree/react-migration).
> Lo que está **online ahora** es la versión que se describe abajo.

## Qué hace

- **Estados por materia**: un toque abre un selector con los 4 estados (pendiente, cursando, pendiente de final, aprobada).
- **Nota final y promedio**: nota opcional por materia aprobada; el dashboard muestra el promedio (sin aplazos, calculado solo con las materias que tienen nota cargada).
- **Correlativas**: panel por materia con las *anteriores* ("necesitás") y *posteriores* ("habilita"), más un **árbol de correlativas** dedicado donde al elegir una materia se ilumina toda su cadena.
- **Materias disponibles**: resalta las que ya podés cursar (con las previas en curso) y avisa si marcás algo sin tener las correlativas.
- **Dashboard**: porcentaje aprobado, promedio, conteos, barra de progreso y los títulos intermedios (Analista en 3°, Ingeniero al final) con cuántas materias faltan para cada uno.
- **Perfil**: nombre y foto opcional, con un saludo de bienvenida la primera vez.
- **Exportar resumen en PDF**: una carilla linda para vista rápida.
- **Backup**: exportar e importar tu progreso en `.json` (para respaldo o para compartirlo).
- **Guardado automático** en tu navegador.

## Cómo usar

1. Entrá al sitio publicado.
2. Tocá una materia para marcar su estado (y cargar la nota si está aprobada).
3. Usá el botón de la derecha de cada materia para ver sus correlativas, o abrí el **Árbol** para ver el mapa completo.
4. Menú **Opciones** (arriba a la derecha): exportar PDF, exportar/importar backup o reiniciar.

## Privacidad

Todo se guarda **localmente en tu navegador** (localStorage). No se envía nada a ningún servidor: tus datos quedan solo en tu dispositivo. Si borrás los datos del navegador se pierden, así que conviene usar **Exportar backup** cada tanto.

## Tecnología

Versión online: un único archivo `index.html` (HTML + CSS + JavaScript, sin dependencias más allá de las tipografías de Google Fonts), hosteado en GitHub Pages. La próxima versión migra a **Vite + React + TypeScript** (ver la nota del principio).

## Aclaración

Proyecto hecho por estudiantes, **sin afiliación oficial con UADE**. El plan y las correlativas se cargaron a mano y pueden contener errores o quedar desactualizados: verificá siempre con la información oficial de la universidad.

## Autoría

Creado por **Marina Luz Zaragoza**.

## Licencia

Distribuido bajo licencia MIT. Ver [LICENSE](LICENSE).
