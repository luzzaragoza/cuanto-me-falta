import { useEffect, useState } from 'react'
import { Perfil } from '../types'
import { store } from '../state/store'
import { PlanActivo } from '../state/planActivo'
import { authHabilitado } from '../lib/supabase'
import { Foto } from '../lib/image'
import { useSession } from '../state/auth'
import { PLANES, nombreUniversidad } from '../data/planes'
import { GoogleG } from './AccountBox'
import { ArbolFondo } from './ArbolFondo'
import { Auth } from '../state/auth'

// Marca en serif de sistema (Georgia) para que el ¿ del logo sea idéntico al del
// favicon / OG: esos son PNG y SVG rasterizados, así que no pueden pedir una webfont
// y caen a la serif del sistema. El wordmark de abajo sí usa la display de la app.
//
// El acento y la tinta van LITERALES, no como tokens: este badge tiene que coincidir
// con el favicon y la imagen de OG, que son PNG generados aparte. Si siguiera a la
// paleta, un cambio de colores dejaría el logo de la app distinto del de la pestaña
// del navegador y del que se ve al compartir el link.
//
// ⚠️ Estos dos hex son los MISMOS que `GOLD` y `WHITE` en scripts/gen-icons.mjs.
// Cambiarlos acá sin correr ese script deja el badge distinto del favicon.
const LogoBadge = () => (
  <svg viewBox="0 0 100 100" width="54" height="54" aria-hidden="true">
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

const EstadosIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="M8 12l3 3 5-6" />
  </svg>
)
const CorrIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="5" rx="1.6" />
    <rect x="3" y="16" width="6" height="5" rx="1.6" />
    <rect x="15" y="16" width="6" height="5" rx="1.6" />
    <path d="M12 8v3M6 16v-2.5h12V16" />
  </svg>
)
const AvanceIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V8M17 20v-9" />
  </svg>
)
const Check = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const FEATURES = [
  { Icon: EstadosIcon, t: 'Estados', d: 'pendiente, cursando, final o aprobada', tono: 'need' },
  { Icon: CorrIcon, t: 'Correlativas', d: 'qué necesitás antes y qué habilita después', tono: 'unlock' },
  { Icon: AvanceIcon, t: 'Avance', d: 'cuánto te falta para el título', tono: 'need' },
]

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Pantalla táctil: el teclado es VIRTUAL y ocupa media pantalla. Ahí el paso del nombre
 * no enfoca solo el campo (abrirlo tapaba la opción de Google, que queda abajo) y el
 * Enter del teclado cierra el teclado en vez de entrar — si no, "OK" te mandaba a la
 * app sin haber visto nunca la oferta de sincronizar.
 */
const tactil = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * Bienvenida de primera visita, en TRES pasos (rediseño 3-sep):
 *   1. Marca + qué hace la app → "Empezar".
 *   2. Elegir carrera. Cada plan es una tarjeta, y la elegida despliega de qué
 *      tamaño es (materias · años · títulos): eso contesta "¿es la mía?" sin
 *      obligar a entrar para verlo.
 *   3. El nombre → "Empezá". Debajo, y como opción secundaria, entrar con Google.
 *
 * El orden importa: antes Google estaba en el PRIMER paso, o sea que lo primero
 * que la app pedía era una cuenta. Ahora primero se elige lo propio (la carrera,
 * el nombre) y recién al final aparece la sincronización, para quien la quiera.
 */
export function Welcome({ onClose }: { onClose: () => void }) {
  const session = useSession()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [planId, setPlanId] = useState(PlanActivo.id())
  const [entrando, setEntrando] = useState(false)

  // volvió del redirect de Google ya logueado → al último paso, con el nombre puesto
  useEffect(() => {
    if (session) setPaso(3)
  }, [session])

  const metaGoogle = session?.user.user_metadata as
    | { full_name?: string; name?: string; avatar_url?: string }
    | undefined
  const nombreGoogle = (metaGoogle?.full_name || metaGoogle?.name || '').trim()

  const start = async (conNombre: boolean) => {
    setEntrando(true)
    const perfil = session
      ? new Perfil(
          nombreGoogle,
          metaGoogle?.avatar_url ? await Foto.desdeUrl(metaGoogle.avatar_url) : '',
        )
      : new Perfil(conNombre ? name.trim() : '', '')
    if (planId === PlanActivo.id()) {
      store.setPerfil(perfil)
      onClose()
    } else {
      // eligió otra carrera: recargamos en ese plan con este perfil
      PlanActivo.cambiarA(planId, perfil, true)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape sale de la bienvenida: se marca el perfil como visto (vacío) para
      // no volver a preguntar en cada visita.
      if (e.key === 'Escape') {
        store.setPerfil(new Perfil('', ''))
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nombreCorto = name.trim().split(/\s+/)[0]

  return (
    <div className="welcome">
      {/* El escenario: el diseño está compuesto en 1200×700 con el naipe a 58px de
          SU borde, no del borde de la ventana. Metiendo los dos adentro de una caja
          de ese tamaño, la relación entre el árbol y el naipe se mantiene igual en
          cualquier pantalla; lo que sobra queda como papel a los costados. */}
      <div className="w-escena">
        <ArbolFondo />
        <div className="welcome-card">
        <div className="w-pasos" role="progressbar" aria-valuenow={paso} aria-valuemin={1} aria-valuemax={3}>
          {([1, 2, 3] as const).map((n) => (
            <span key={n} className={'w-paso' + (n === paso ? ' on' : n < paso ? ' hecho' : '')} />
          ))}
        </div>

        {paso === 1 && (
          <>
            <span className="w-logo">
              <LogoBadge />
            </span>
            <h1 className="w-brand">¿Cuánto me falta?</h1>
            <p className="w-tag">
              Seguí el avance de tu carrera de un vistazo. Sin planillas, sin contar materias a
              mano.
            </p>

            <div className="w-features">
              {FEATURES.map(({ Icon, t, d, tono }) => (
                <div className="w-feat" key={t}>
                  <span className={`w-feat-ic ${tono}`}>
                    <Icon />
                  </span>
                  <span className="w-feat-tx">
                    <b>{t}</b>
                    <small>{d}</small>
                  </span>
                </div>
              ))}
            </div>

            <button className="btn w-go" onClick={() => setPaso(2)}>
              Empezar
            </button>
            <p className="w-priv">Toma menos de un minuto.</p>
          </>
        )}

        {paso === 2 && (
          <>
            <h1 className="w-tit">¿Qué estás estudiando?</h1>
            <p className="w-sub">
              Podés cambiar de carrera después: cada plan guarda su propio avance.
            </p>

            <div className="w-planes">
              {PLANES.map((p) => {
                const sel = p.id === planId
                const anios = Math.max(...p.materias.map((m) => m.anio))
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={'w-plan' + (sel ? ' sel' : '')}
                    aria-pressed={sel}
                    onClick={() => setPlanId(p.id)}
                  >
                    <span className="w-plan-dot">{sel && <Check />}</span>
                    <span className="w-plan-tx">
                      <span className="w-plan-nom">{p.carrera}</span>
                      <span className="w-plan-meta">
                        {nombreUniversidad(p.universidad)} · Plan {p.codigo} — {p.anio}
                      </span>
                      {/* El tamaño del plan solo cuando está elegida: en las cuatro a la
                          vez sería ruido, y acá contesta "¿es esta?" antes de entrar. */}
                      {sel && (
                        <span className="w-plan-chips">
                          <span className="w-chip need">{plural(p.materias.length, 'materia', 'materias')}</span>
                          <span className="w-chip unlock">{plural(anios, 'año', 'años')}</span>
                          <span className="w-chip neutro">{plural(p.titulos.length, 'título', 'títulos')}</span>
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            <button className="btn w-go" onClick={() => setPaso(3)}>
              Seguir
            </button>
            <button className="lnk w-back" onClick={() => setPaso(1)}>
              ← Volver
            </button>
          </>
        )}

        {paso === 3 && (
          <>
            <h1 className="w-tit">¿Cómo te llamás?</h1>
            <p className="w-sub">Para saludarte al entrar. Nada más.</p>

            {session ? (
              <div className="w-hola">
                {metaGoogle?.avatar_url && (
                  <img className="acct-pic" src={metaGoogle.avatar_url} alt="" referrerPolicy="no-referrer" />
                )}
                <span>
                  ¡Hola, <b>{nombreGoogle || session.user.email}</b>! Tu avance va a quedar
                  sincronizado con tu cuenta.
                </span>
              </div>
            ) : (
              <input
                id="w-name"
                className="w-name"
                type="text"
                placeholder="Tu nombre"
                maxLength={40}
                value={name}
                autoFocus={!tactil()}
                enterKeyHint={tactil() ? 'done' : 'go'}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (tactil()) e.currentTarget.blur()
                    else void start(true)
                  }
                }}
              />
            )}

            <button className="btn w-go" disabled={entrando} onClick={() => void start(true)}>
              {entrando ? 'Entrando…' : nombreCorto && !session ? `Empezá, ${nombreCorto}` : 'Empezá'}
            </button>

            {authHabilitado && !session && (
              <>
                <div className="w-o">
                  <span />
                  <em>o si usás la app en varios lados</em>
                  <span />
                </div>
                <div className="w-google">
                  <button className="btn ghost gbtn" onClick={() => void Auth.entrarConGoogle()}>
                    <GoogleG />
                    Entrar con Google y sincronizar
                  </button>
                  <p className="acct-hint">
                    Guardamos en tu cuenta el estado de tus materias, tus notas, los nombres de
                    tus optativas y tu nombre de perfil, para que te sigan entre dispositivos.
                    Nadie más puede verlo — ni siquiera otras cuentas. Al entrar aceptás los{' '}
                    <a href="/terminos.html" target="_blank" rel="noopener noreferrer">
                      Términos
                    </a>{' '}
                    y la{' '}
                    <a href="/privacidad.html" target="_blank" rel="noopener noreferrer">
                      Privacidad
                    </a>
                    .
                  </p>
                </div>
              </>
            )}

            <div className="w-pie">
              <button className="lnk w-back" onClick={() => setPaso(2)}>
                ← Volver
              </button>
              {!session && (
                <button className="lnk w-skip" disabled={entrando} onClick={() => void start(false)}>
                  Entrar sin nombre
                </button>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
