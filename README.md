# ¿Cuánto me falta?

Seguimiento interactivo de la carrera **Ingeniería en Informática (UADE — Plan 1621)**.
Marcá el estado de cada materia, mirá las correlativas y tu avance de un vistazo.

## Qué hace

- **Estados por materia**: pendiente → aprobada → cursando → pendiente de final (un toque cambia el estado).
- **Correlativas precargadas**: cada materia tiene un botón que muestra sus correlativas *anteriores* ("necesita") y *posteriores* ("habilita"), con nombres navegables para recorrer la cadena.
- **Dashboard**: porcentaje aprobado, promedio, conteos, barra de progreso y los títulos intermedios (Analista, Ingeniero) con cuántas materias faltan para cada uno.
- **Perfil**: nombre y foto opcional, con un saludo de bienvenida la primera vez.
- **Exportar resumen en PDF**: una carilla linda para vista rápida.
- **Backup**: exportar e importar tu progreso en `.json` (para respaldo o para compartirlo).
- **Guardado automático** en tu navegador.

## Cómo usar

1. Entrá al sitio publicado.
2. Tocá una materia para marcar su estado.
3. Usá el botón de la derecha de cada materia para ver sus correlativas.
4. Menú **Opciones** (arriba a la derecha): exportar PDF, exportar/importar backup o reiniciar.

## Privacidad

Todo se guarda **localmente en tu navegador** (localStorage). No se envía nada a ningún servidor: tus datos quedan solo en tu dispositivo. Si borrás los datos del navegador se pierden, así que conviene usar **Exportar backup** cada tanto.

## Tecnología

**Vite + React 19 + TypeScript**, con [React Flow](https://reactflow.dev/) para el árbol de correlativas. El estado del usuario se guarda en `localStorage` (sin servidor). Se publica en GitHub Pages mediante GitHub Actions.

> Versión anterior: era un único `index.html` vanilla. Quedó como referencia en [`legacy/index.html`](legacy/index.html) durante la migración.

## Desarrollo

Requiere [Node.js](https://nodejs.org/) (18+).

```bash
npm install      # instalar dependencias (una vez)
npm run dev      # servidor local con hot-reload → http://localhost:5173
npm run build    # build de producción (chequea tipos + empaqueta en dist/)
npm run preview  # previsualizar el build de producción
```

El deploy es automático: cada push a `main` dispara el workflow de GitHub Actions que buildea y publica. (Requiere *Settings → Pages → Source = GitHub Actions* en el repo.)

## Aclaración

Proyecto hecho por estudiantes, **sin afiliación oficial con UADE**. El plan y las correlativas se cargaron a mano y pueden contener errores o quedar desactualizados: verificá siempre con la información oficial de la universidad.

## Autoría

Creado por **Marina Luz Zaragoza**.

## Licencia

Distribuido bajo licencia MIT. Ver [LICENSE](LICENSE).
