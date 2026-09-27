// Instalar la app (PWA). Lo que el navegador ofrece NO es lo mismo en todos lados,
// y la diferencia define lo que se le puede mostrar al usuario:
//
// - Chromium (Android, escritorio): dispara `beforeinstallprompt` cuando la app es
//   instalable. Ese evento se puede GUARDAR y disparar después — es la única forma
//   de tener un botón "Instalar" de verdad.
// - Safari en iOS: no existe ese evento ni forma de instalar por código. Lo único
//   que se puede hacer es CONTAR el gesto (compartir → Agregar a inicio).
// - El resto (Firefox, o ya instalada): no hay nada que ofrecer.
//
// El listener se cuelga al IMPORTAR este módulo, no dentro de un componente: el
// evento llega apenas carga la página, mucho antes de que se monte nada, y si no
// hay quien lo escuche en ese momento se pierde para siempre.

/**
 * Dónde queda anotado que ya no hay que ofrecer más. Solo se escribe cuando la
 * persona lo dice: "No mostrar más", o cuando ya la instaló. **"Ahora no" no escribe
 * nada** — es un "después", no un "no", y la próxima vez que abra la app vuelve a
 * aparecer. Un aviso que se descarta para siempre al primer toque distraído es un
 * aviso que la mayoría nunca llega a leer.
 */
const CLAVE = 'cmf-instalar'
/**
 * La franja de iOS que esto reemplazó guardaba su descarte acá. Se sigue leyendo:
 * quien ya dijo que no a la misma propuesta no tiene por qué volver a decirlo. No se
 * escribe nunca más, así que la clave se muere sola con el tiempo.
 */
const CLAVE_VIEJA = 'cmf-aviso-ios'

/** El evento de Chromium. No está en los tipos estándar del DOM. */
interface PromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let guardado: PromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // sin esto Chrome muestra su propia barra, y quedan dos invitaciones a la vez
    e.preventDefault()
    guardado = e as PromptEvent
  })
  // instalada por cualquier vía: el evento guardado ya no sirve
  window.addEventListener('appinstalled', () => {
    guardado = null
  })
}

export const Instalar = {
  /** iPhone/iPad (el iPad moderno se reporta como Mac con touch). */
  esIOS(): boolean {
    return (
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    )
  },

  /**
   * ¿Dijo que no quiere que se le ofrezca más? Con el storage bloqueado (incógnito)
   * se contesta que sí: no se puede recordar la respuesta, así que ofrecer sería
   * preguntar lo mismo en cada carga.
   */
  rechazado(): boolean {
    try {
      return localStorage.getItem(CLAVE) === 'nunca' || !!localStorage.getItem(CLAVE_VIEJA)
    } catch {
      return true
    }
  },

  /** "No mostrar más", o ya la instaló. Es la única forma de que deje de aparecer. */
  noOfrecerMas(): void {
    try {
      localStorage.setItem(CLAVE, 'nunca')
    } catch {
      /* incógnito con storage bloqueado: se pierde, y se vuelve a ofrecer */
    }
  },

  /** ¿Corresponde ofrecerlo ahora? Lo que el navegador permite Y lo que ella dijo. */
  ofrecer(): boolean {
    return !this.rechazado() && this.sePuede()
  },

  /** ¿Ya corre instalada (agregada a inicio)? Ahí no hay nada que ofrecer. */
  instalada(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    )
  },

  /** ¿Hay un botón "Instalar" de verdad, o solo se puede explicar el gesto? */
  conBoton(): boolean {
    return guardado !== null
  },

  /**
   * ¿Tiene sentido ofrecer instalar? Sí cuando el navegador nos dio el evento, o
   * cuando es iOS en el navegador (ahí se explica el gesto a mano).
   */
  sePuede(): boolean {
    if (this.instalada()) return false
    return guardado !== null || this.esIOS()
  },

  /** Dispara el diálogo del navegador. Devuelve si el usuario aceptó. */
  async pedir(): Promise<boolean> {
    if (!guardado) return false
    const e = guardado
    guardado = null // el evento se consume: no se puede volver a disparar
    await e.prompt()
    const { outcome } = await e.userChoice
    return outcome === 'accepted'
  },
}
