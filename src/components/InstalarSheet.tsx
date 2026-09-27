import { useEffect, useRef, useState } from 'react'
import { Instalar } from '../lib/instalar'
import { Analytics } from '../lib/analytics'
import { useExitAnimation } from '../hooks/useExitAnimation'

// El badge de la app. Mismos hex literales que Welcome y `scripts/gen-icons.mjs`:
// tiene que ser el MISMO ícono que va a quedar en la pantalla de inicio.
const LogoBadge = () => (
  <svg viewBox="0 0 100 100" width="46" height="46" aria-hidden="true">
    <rect x="4" y="4" width="92" height="92" rx="26" fill="#c67139" />
    <text
      x="50"
      y="76"
      textAnchor="middle"
      fontFamily="Georgia, 'Times New Roman', serif"
      fontSize="74"
      fontWeight="700"
      fill="#fff9f0"
    >
      ¿
    </text>
  </svg>
)

// Ícono "compartir" de iOS (cuadrado con flecha para arriba), para que se reconozca
// QUÉ botón tocar en Safari.
const IconShare = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v13" />
    <path d="M8 7l4-4 4 4" />
    <path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
  </svg>
)

/**
 * La invitación a instalar, al cerrar el tutorial. Es el último paso del onboarding:
 * el momento en que alguien ya vio para qué sirve la app es cuando tiene sentido
 * pedirle un lugar en su pantalla de inicio — antes es pedir sin haber dado nada.
 *
 * Reemplaza a la franja fija que vivía arriba de todo: esa aparecía en cada visita
 * hasta que la descartaras, y ocupaba lugar en la pantalla del 100% de la gente para
 * hablarle al pedazo que no la tenía instalada.
 *
 * Dice cosas distintas según lo que el navegador permita (ver `lib/instalar.ts`):
 * con `beforeinstallprompt` hay un botón que instala de verdad; en iOS solo se puede
 * explicar el gesto, así que el botón primario cierra y el texto cuenta los pasos.
 *
 * Tres salidas, y la diferencia entre dos de ellas importa: **"Ahora no" es un
 * después** (vuelve a aparecer la próxima vez que abra la app) y "No mostrar más" es
 * un no (no vuelve nunca). Antes había una sola, y cerrarla —por lo que fuera, incluso
 * tocando afuera sin querer— valía como "no" definitivo: la invitación se gastaba en
 * el peor momento posible, que es cuando la persona todavía no la leyó.
 */
export function InstalarSheet({ onClose }: { onClose: (motivo: 'luego' | 'nunca') => void }) {
  const [conBoton] = useState(() => Instalar.conBoton())
  // El motivo se decide al tocar y se entrega al terminar la animación de salida.
  // Cerrar por afuera (clic en el fondo, Escape) es un "después": no es una respuesta.
  const motivo = useRef<'luego' | 'nunca'>('luego')
  const { closing, requestClose, onExitEnd } = useExitAnimation(() => onClose(motivo.current))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  const cerrarCon = (m: 'luego' | 'nunca') => {
    motivo.current = m
    requestClose()
  }

  const instalar = async () => {
    Analytics.evento('instalar_aceptado')
    // En iOS el botón no instala nada (no existe la API): lo que dice es "ya la
    // agregué". En los dos casos la respuesta es la misma — no volver a ofrecer.
    if (conBoton) await Instalar.pedir()
    cerrarCon('nunca')
  }

  return (
    <div
      className={'sheet-wrap' + (closing ? ' closing' : '')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div className="hoja" role="dialog" aria-label="Instalar la app" onAnimationEnd={onExitEnd}>
        <div className="hoja-in">
          <span className="hoja-logo">
            <LogoBadge />
          </span>
          <div className="hoja-tx">
            <div className="hoja-tit">Tenela a mano</div>
            {conBoton ? (
              <p>
                Instalá ¿Cuánto me falta? y abrila como una app, sin navegador. Funciona sin
                internet.
              </p>
            ) : (
              <p>
                Agregala a tu pantalla de inicio y abrila como una app, sin navegador. Funciona
                sin internet. Tocá <IconShare /> <b>Compartir</b> y elegí{' '}
                <b>Agregar a inicio</b>.
              </p>
            )}
          </div>
          <div className="hoja-acts">
            <button
              className="lnk hoja-nunca"
              type="button"
              onClick={() => {
                Analytics.evento('instalar_nunca')
                cerrarCon('nunca')
              }}
            >
              No mostrar más
            </button>
            <button className="lnk" type="button" onClick={() => cerrarCon('luego')}>
              Ahora no
            </button>
            <button className="btn" type="button" onClick={() => void instalar()}>
              {conBoton ? 'Instalar' : 'Listo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
