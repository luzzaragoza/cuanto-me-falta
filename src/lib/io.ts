/**
 * Utilidades de archivo del navegador.
 *
 * Son `static` porque no hay estado que guardar: la clase existe para darles un nombre y
 * un lugar común, no para instanciarse.
 */
export class Archivo {
  /** Dispara la descarga de un archivo de texto en el navegador. */
  static descargar(filename: string, content: string, type = 'application/json'): void {
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

  /**
   * Slug para nombres de archivo, a partir del nombre del perfil.
   *
   * Ojo: NO es el mismo que `PlanNuevo.slug`, y la diferencia importa. Aquel genera el
   * `id` PERMANENTE de un plan (se corta en 60 caracteres y no tiene fallback, porque un
   * id vacío rompería el progreso guardado); éste solo bautiza una descarga y cae en
   * 'plan' si no hay nombre. Comparten la forma, no el contrato.
   */
  static slug(name: string | undefined): string {
    const s = (name ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // saca tildes/diacríticos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return s || 'plan'
  }

  /**
   * Imprime el resumen (`#print-summary`, visible solo en `@media print`).
   *
   * Es SINCRÓNICO a propósito: `window.print()` tiene que correr dentro del gesto del
   * usuario (el click), si no algunos navegadores lo bloquean. La foto (data URL) ya está
   * montada en el DOM desde que abre la app, así que no hay nada que esperar.
   */
  static imprimirResumen(): void {
    window.print()
  }
}
