// Dónde vive cada cosa del video.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const AQUI = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(AQUI, '..', '..')
/** Lo que se entrega: el MP4 y la hoja de revisión. */
export const SALIDA = join(ROOT, 'video')
/** Intermedios (capturas, cuadros, audio). No se versionan. */
export const TMP = join(SALIDA, 'tmp')
/** Chromium preinstalado del entorno; si no está, Playwright usa el suyo. */
export const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'
