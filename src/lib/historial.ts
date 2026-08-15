// Deshacer lo último (Ctrl+Z) mientras se carga un plan.
//
// Es la otra mitad de lo que pidió Luz: el panel de cambios responde *"¿qué le estoy por
// cambiar a los alumnos?"* comparando contra la foto publicada; esto responde
// *"me equivoqué recién, volvé"*. Son preguntas distintas y por eso conviven:
//
//   · el PANEL es una comparación contra lo publicado → sobrevive a recargar, y deshacer
//     ahí puede saltear diez pasos intermedios;
//   · el HISTORIAL es una pila de acciones de ESTA sesión → se pierde al recargar, y
//     deshace exactamente lo último.
//
// QUÉ SE REGISTRA Y QUÉ NO: acciones discretas (agregar, borrar, mover, tildar OPT,
// conectar una correlativa, tocar los títulos) y los campos de texto **al confirmarse**,
// no en cada tecla. Adentro de un `<input>` con el foco puesto, el navegador ya tiene su
// propio deshacer por carácter, y pisarlo con el nuestro daría un Ctrl+Z que a veces
// borra una letra y a veces borra una materia entera — impredecible es peor que ausente.

import type { Borrador } from './editorPlan'
import type { Guardado } from './cambios'

export interface Accion {
  /** Qué se hizo, en castellano. Se le muestra a la persona al deshacer. */
  etiqueta: string
  /** El borrador tal como estaba ANTES de la acción. */
  antes: Borrador
  /** Qué escritura hay que hacer para que la base vuelva a `antes`. */
  guardar: Guardado | null
}

/**
 * La pila de acciones deshacibles. Inmutable: cada operación devuelve un historial nuevo,
 * igual que el `Borrador` que custodia.
 */
export class Historial {
  private readonly pila: readonly Accion[]
  /**
   * Cuántas acciones se recuerdan. Acotado a propósito: cada entrada guarda un borrador
   * ENTERO, y una sesión larga de carga puede tener cientos de acciones. Treinta cubre
   * de sobra el "me equivoqué recién" sin quedarse con medio plan por duplicado en
   * memoria treinta veces.
   */
  readonly limite: number

  constructor(pila: readonly Accion[] = [], limite = 30) {
    this.pila = pila
    this.limite = limite
  }

  /** Apila una acción. Si se pasa del límite, se olvida la más vieja. */
  con(accion: Accion): Historial {
    const pila = [...this.pila, accion]
    return new Historial(pila.slice(-this.limite), this.limite)
  }

  get puedeDeshacer(): boolean {
    return this.pila.length > 0
  }

  get profundidad(): number {
    return this.pila.length
  }

  /** La última acción, sin sacarla. Sirve para el rótulo del botón. */
  get ultima(): Accion | undefined {
    return this.pila[this.pila.length - 1]
  }

  /**
   * Saca la última acción y devuelve el historial sin ella. `null` si no hay nada que
   * deshacer — así el llamador no tiene que preguntar antes.
   */
  deshacer(): { historial: Historial; accion: Accion } | null {
    const accion = this.ultima
    if (!accion) return null
    return { historial: new Historial(this.pila.slice(0, -1), this.limite), accion }
  }

  /** Vacía la pila. Se usa al publicar: lo anterior ya es historia de otra versión. */
  vaciado(): Historial {
    return new Historial([], this.limite)
  }
}
