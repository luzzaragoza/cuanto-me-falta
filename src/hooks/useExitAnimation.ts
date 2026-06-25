import { useCallback, useState, type AnimationEvent } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Maneja la animación de salida de un overlay: difiere el desmontaje hasta que
 * termina la animación de cierre.
 *
 * - `closing`: agregá la clase `.closing` al overlay cuando sea true.
 * - `requestClose`: arranca el cierre (o cierra al toque si el sistema pide menos movimiento).
 * - `onExitEnd`: pasalo al `onAnimationEnd` del elemento que anima (cierra cuando termina).
 */
export function useExitAnimation(onClose: () => void) {
  const [closing, setClosing] = useState(false)

  const requestClose = useCallback(() => {
    if (prefersReduced()) {
      onClose()
      return
    }
    setClosing(true)
  }, [onClose])

  const onExitEnd = useCallback(
    (e: AnimationEvent<Element>) => {
      // solo la animación propia del overlay (no las que burbujean de los hijos)
      if (closing && e.target === e.currentTarget) onClose()
    },
    [closing, onClose],
  )

  return { closing, requestClose, onExitEnd }
}
