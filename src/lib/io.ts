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
 * Imprime el resumen (#print-summary, visible solo en @media print).
 * Es SINCRÓNICO a propósito: `window.print()` tiene que correr dentro del gesto del
 * usuario (el click), si no algunos navegadores lo bloquean. La foto (data URL) ya está
 * montada en el DOM desde que abre la app, así que no hay que esperar a que cargue.
 */
export function printSummary() {
  window.print()
}
