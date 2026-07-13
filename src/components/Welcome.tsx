import { useEffect, useState } from 'react'
import { store } from '../state/store'
import { cambiarAPlan, planActivoId } from '../state/planActivo'
import { authHabilitado } from '../lib/supabase'
import { photoFromUrl } from '../lib/image'
import { useSession } from '../state/auth'
import { AccountBox } from './AccountBox'
import { CarreraSelect } from './CarreraSelect'

// Marca en serif de sistema (Georgia) para que el ¿ del logo sea idéntico al
// del favicon / OG (generados con esa fuente). El wordmark de abajo sí usa Fraunces.
const LogoBadge = () => (
  <svg viewBox="0 0 100 100" width="60" height="60" aria-hidden="true">
    <rect x="4" y="4" width="92" height="92" rx="22" fill="#c39200" />
    <text
      x="50"
      y="76"
      textAnchor="middle"
      fontFamily="Georgia, 'Times New Roman', serif"
      fontSize="74"
      fontWeight="700"
      fill="#fff"
    >
      ¿
    </text>
  </svg>
)

const EstadosIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 12l3 3 5-6" />
  </svg>
)
const CorrIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="5" rx="1.2" />
    <rect x="3" y="16" width="6" height="5" rx="1.2" />
    <rect x="15" y="16" width="6" height="5" rx="1.2" />
    <path d="M12 8v3M6 16v-2.5h12V16" />
  </svg>
)
const AvanceIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V8M17 20v-9" />
  </svg>
)

const FEATURES = [
  { Icon: EstadosIcon, t: 'Estados', d: 'marcá cada materia' },
  { Icon: CorrIcon, t: 'Correlativas', d: 'mirá qué habilita qué' },
  { Icon: AvanceIcon, t: 'Avance', d: 'cuánto te falta para el título' },
]

/**
 * Bienvenida de primera visita, en DOS pasos (decisión Luz):
 *   1. Marca + qué hace la app + decidir cómo entrar: con Google (sincroniza) o
 *      sin cuenta (los datos quedan en el dispositivo — mismo párrafo que el link).
 *   2. Elegir la carrera (+ nombre, solo si no entró con Google) → Empezá.
 * Si entra con Google, el nombre y la foto salen de su cuenta y no se le piden.
 * Sin backend configurado (dev/CI), el paso 1 muestra un único "Continuar".
 */
export function Welcome({ onClose }: { onClose: () => void }) {
  const session = useSession()
  const [paso, setPaso] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [planId, setPlanId] = useState(planActivoId())
  const [entrando, setEntrando] = useState(false)

  // volvió del redirect de Google ya logueado → directo al paso de carrera
  useEffect(() => {
    if (session) setPaso(2)
  }, [session])

  const metaGoogle = session?.user.user_metadata as
    | { full_name?: string; name?: string; avatar_url?: string }
    | undefined
  const nombreGoogle = (metaGoogle?.full_name || metaGoogle?.name || '').trim()

  const start = async () => {
    setEntrando(true)
    const perfil = session
      ? {
          name: nombreGoogle,
          photo: metaGoogle?.avatar_url ? await photoFromUrl(metaGoogle.avatar_url) : '',
        }
      : { name: name.trim(), photo: '' }
    if (planId === planActivoId()) {
      store.setPerfil(perfil)
      onClose()
    } else {
      // eligió otra carrera: recargamos en ese plan con este perfil
      cambiarAPlan(planId, perfil, true)
    }
  }
  // "entrar sin nombre": marcamos el perfil como visto (vacío) para no re-preguntar
  const skip = () => {
    store.setPerfil({ name: '', photo: '' })
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="welcome">
      <div className="welcome-card">
        <span className="w-logo">
          <LogoBadge />
        </span>
        <h1 className="w-brand">
          <span className="q">¿</span>Cuánto me falta<span className="q">?</span>
        </h1>
        <p className="w-tag">Seguí el avance de tu carrera de un vistazo.</p>

        {paso === 1 && (
          <>
            <div className="w-features">
              {FEATURES.map(({ Icon, t, d }) => (
                <div className="w-feat" key={t}>
                  <span className="w-feat-ic">
                    <Icon />
                  </span>
                  <span className="w-feat-tx">
                    <b>{t}</b>
                    <small>{d}</small>
                  </span>
                </div>
              ))}
            </div>

            {authHabilitado ? (
              <div className="w-acct">
                <AccountBox />
                <p className="w-nocta">
                  <button className="lnk w-next" onClick={() => setPaso(2)}>
                    Seguir sin cuenta
                  </button>{' '}
                  — tus datos quedan solo en este dispositivo.
                </p>
              </div>
            ) : (
              <div className="w-start">
                <button className="btn w-go w-next" onClick={() => setPaso(2)}>
                  Continuar →
                </button>
                <p className="w-priv">Tus datos quedan solo en este dispositivo.</p>
              </div>
            )}
          </>
        )}

        {paso === 2 && (
          <>
            {session && (
              <div className="w-hola">
                {metaGoogle?.avatar_url && (
                  <img className="acct-pic" src={metaGoogle.avatar_url} alt="" referrerPolicy="no-referrer" />
                )}
                <span>
                  ¡Hola, <b>{nombreGoogle || session.user.email}</b>! Tu avance va a quedar
                  sincronizado con tu cuenta.
                </span>
              </div>
            )}

            <div className="w-start">
              <label>Elegí tu carrera</label>
              <CarreraSelect value={planId} onChange={setPlanId} />
            </div>

            {session ? (
              <div className="w-start">
                <button className="btn w-go" disabled={entrando} onClick={() => void start()}>
                  {entrando ? 'Entrando…' : 'Empezá →'}
                </button>
              </div>
            ) : (
              <>
                <div className="w-start">
                  <label htmlFor="w-name">¿Cómo te llamás?</label>
                  <div className="w-start-row">
                    <input
                      id="w-name"
                      type="text"
                      placeholder="Tu nombre"
                      maxLength={40}
                      value={name}
                      autoFocus
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void start()
                        }
                      }}
                    />
                    <button className="btn" disabled={entrando} onClick={() => void start()}>
                      Empezá →
                    </button>
                  </div>
                </div>
                <button className="lnk w-skip" onClick={skip}>
                  Entrar sin nombre
                </button>
              </>
            )}

            <button className="lnk w-back" onClick={() => setPaso(1)}>
              ← Volver
            </button>
          </>
        )}
      </div>
    </div>
  )
}
