// Hace el video completo: graba la app, compone los cuadros, sintetiza el sonido
// y los une. Correr con:  node scripts/video/hacer.mjs
//
// Pasos sueltos, para no rehacer todo cuando se toca una sola cosa:
//   node scripts/video/hacer.mjs capturar componer sonido unir hoja
// (por ejemplo, `... sonido unir` si solo cambió el sonido).
//
// Necesita ffmpeg y Python 3 con numpy. Deja el resultado en video/.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { capturar } from './capturar.mjs'
import { componer } from './componer.mjs'
import { hoja } from './hoja.mjs'
import { AQUI, SALIDA, TMP } from './rutas.mjs'

const pedidos = process.argv.slice(2)
const toca = (paso) => pedidos.length === 0 || pedidos.includes(paso)
const correr = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })
mkdirSync(TMP, { recursive: true })

if (toca('capturar')) await capturar()
if (toca('componer')) await componer()
if (toca('sonido')) correr('python3', [join(AQUI, 'sonido.py'), join(TMP, 'guion.json'), join(TMP, 'sonido.wav')])
if (toca('unir')) {
  const destino = join(SALIDA, 'nada-abu-me-recibi.mp4')
  correr('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-i', join(TMP, 'imagen.mp4'), '-i', join(TMP, 'sonido.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', '-shortest', destino,
  ])
  console.log(`✓ video → ${destino}`)
}
if (toca('hoja')) await hoja()
