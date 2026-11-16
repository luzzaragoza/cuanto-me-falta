import type { Estado } from '../types'

/**
 * La casilla de estado. Una sola para toda la app (la fila del plan, el selector
 * de estado), para que "aprobada" se dibuje igual en todos lados.
 *
 * La diferencia entre estados es de FORMA además de color: vacía · punto · mitad
 * · tilde. El tilde es un trazo y el punto lo dibuja el CSS — antes eran los
 * caracteres "✓" y "•", que no están en la tipografía y cada sistema resolvía con
 * una fuente distinta.
 */
export function Glifo({ estado, className = '' }: { estado: Estado; className?: string }) {
  return (
    <span className={`glifo ${estado}${className ? ' ' + className : ''}`} aria-hidden="true">
      {estado === 'aprobada' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
  )
}
