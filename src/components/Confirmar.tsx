// Confirmaciones con la estética de la app, en vez de `confirm()` y `alert()` del
// navegador.
//
// Los nativos rompen todo: tipografía del sistema operativo, botones en inglés según el
// idioma del navegador, sin colores propios, y en Chrome aparecen pegados arriba del
// todo. En una pantalla que se le va a mostrar a una facultad, eso desentona feo.
//
// Además el nativo no puede hacer lo que acá hace falta: mostrar una LISTA (las
// correlativas que un movimiento rompe, quiénes tienen esa materia como previa) ni
// distinguir una acción destructiva de una común.

import { useEffect, useState, type ReactNode } from 'react'

export interface Pedido {
  titulo: string
  texto?: string
  /** Detalle en lista: qué se rompe, a quién afecta. */
  detalle?: string[]
  /** Texto del botón que confirma. Un verbo, no "OK". */
  confirmar: string
  /** Acción destructiva: el botón va en rojo. */
  peligro?: boolean
  /** Solo informa: un botón para cerrar, sin "Cancelar" (algo que YA pasó). */
  aviso?: boolean
  onSi?: () => void
}

/**
 * Devuelve el diálogo listo para renderizar y la función que lo pide.
 *
 * ```tsx
 * const { pedir, dialogo } = useConfirmar()
 * …
 * <button onClick={() => pedir({ titulo: '¿Borrar?', confirmar: 'Borrar', peligro: true, onSi: borrar })}>
 * {dialogo}
 * ```
 */
export function useConfirmar(): { pedir: (p: Pedido) => void; dialogo: ReactNode } {
  const [pedido, setPedido] = useState<Pedido | null>(null)

  useEffect(() => {
    if (!pedido) return
    const alTeclado = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPedido(null)
    }
    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [pedido])

  const dialogo = pedido ? (
    /* `cf-wrap` lo pone POR ENCIMA del drawer de publicar (que está en z-index 92). Sin
       eso el diálogo aparecía detrás, desenfocado, y había que cerrar el drawer para
       poder contestarlo. */
    <div className="modal show cf-wrap" onClick={() => setPedido(null)}>
      <div className="sheet cf" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{pedido.titulo}</h2>
        {pedido.texto && <p className="m-desc">{pedido.texto}</p>}
        {pedido.detalle && pedido.detalle.length > 0 && (
          <ul className="cf-detalle">
            {pedido.detalle.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
        <div className="m-actions">
          {!pedido.aviso && (
            <button className="lnk" onClick={() => setPedido(null)}>
              Cancelar
            </button>
          )}
          <button
            className={`btn${pedido.peligro ? ' peligro' : ''}`}
            autoFocus
            onClick={() => {
              const fn = pedido.onSi
              setPedido(null)
              fn?.()
            }}
          >
            {pedido.confirmar}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { pedir: setPedido, dialogo }
}
