/** Dispara la descarga de un archivo de texto en el navegador. */
export function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** slug simple para nombres de archivo (a partir del nombre del perfil). */
export function slug(name: string | undefined): string {
  const s = (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes/diacríticos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'plan'
}

/**
 * Imprime el resumen (#print-summary). Espera a que la foto (data URL) decodifique,
 * si no el PDF puede salir sin avatar.
 */
export async function printSummary() {
  const img = document.querySelector<HTMLImageElement>('#print-summary .ps-av img')
  try {
    if (img) await img.decode()
  } catch {
    /* si falla el decode, igual imprimimos */
  }
  window.print()
}
