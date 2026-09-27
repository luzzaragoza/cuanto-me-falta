import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Perfil } from './types'
import { store, useDB } from './state/store'
import { useSession } from './state/auth'
import { Foto } from './lib/image'
import { plan } from './domain/Plan'
import { PLANES, nombreUniversidad } from './data/planes'
import { PlanActivo } from './state/planActivo'
import { Avatar } from './components/Avatar'
import { CarreraSelect } from './components/CarreraSelect'
import { Dashboard } from './components/Dashboard'
import { NotasPanel } from './components/NotasPanel'
import { OptionsMenu } from './components/OptionsMenu'
import { PlanView } from './components/PlanView'
import { PrintSummary } from './components/PrintSummary'
import { ProfileModal } from './components/ProfileModal'
import { InstalarSheet } from './components/InstalarSheet'
import { StatePopover } from './components/StatePopover'
import { SyncAviso } from './components/SyncAviso'
import { SyncConflicto } from './components/SyncConflicto'
import { ConsentModal } from './components/ConsentModal'
import { Sync, useSyncEstado } from './state/sync'
import { Toaster } from './components/Toaster'
import { Welcome } from './components/Welcome'
import { Tour } from './components/Tour'
import { PASOS_ALUMNO } from './components/tourPasos'

// El árbol vive en un chunk aparte. Con el rediseño (2-sep) dejó de ser pesado
// —murieron elkjs y React Flow, ~506 KB gz— pero el split se queda: no hace falta
// para abrir la app, y el precalentado en idle (abajo) mantiene la primera
// apertura instantánea y el chunk cacheado por el service worker para offline.
const TreeView = lazy(() =>
  import('./components/Tree/TreeView').then((m) => ({ default: m.TreeView })),
)
import { Analytics } from './lib/analytics'
import { Instalar } from './lib/instalar'

const TOUR_KEY = 'cmf-tour-visto'
// Cuánto espera la invitación a instalar cuando la app abre de nuevo. No es estética:
// `beforeinstallprompt` llega DESPUÉS de la carga, así que preguntar antes daría
// siempre que no. Y de paso deja que la pantalla se termine de armar.
const INSTALAR_MS = 3500
const flag = (k: string) => {
  try {
    return !!localStorage.getItem(k)
  } catch {
    // modo incógnito con storage bloqueado: se asume visto, para no repetir avisos
    return true
  }
}
const tourVisto = () => flag(TOUR_KEY)

interface PopState {
  cod: string
  anchor: HTMLElement
}

type Modal = 'closed' | 'welcome' | 'edit'

export function App() {
  const db = useDB()
  const session = useSession()
  const syncEstado = useSyncEstado()
  const conflicto = syncEstado === 'conflicto' ? Sync.conflicto() : null

  // Usuario existente que inicia sesión (desde el perfil o el aviso): si su perfil
  // local no tiene foto, adoptamos la de Google (y el nombre, si tampoco tenía).
  // Un intento por sesión — si falla el fetch no se reintenta en cada render.
  const fotoIntentada = useRef<string | null>(null)
  useEffect(() => {
    const meta = session?.user.user_metadata as
      | { full_name?: string; name?: string; avatar_url?: string }
      | undefined
    const perfil = db.profile
    if (!session || !perfil || perfil.photo || !meta?.avatar_url) return
    if (fotoIntentada.current === session.user.id) return
    fotoIntentada.current = session.user.id
    void Foto.desdeUrl(meta.avatar_url).then((photo) => {
      if (!photo) return
      const name = perfil.name || (meta.full_name || meta.name || '').trim()
      store.setPerfil(new Perfil(name, photo))
    })
  }, [session, db.profile])

  const [pop, setPop] = useState<PopState | null>(null)
  const [tree, setTree] = useState<{ focus: string | null } | null>(null)

  // precalentar el chunk del árbol cuando la app ya quedó tranquila
  useEffect(() => {
    const t = setTimeout(() => void import('./components/Tree/TreeView'), 2500)
    return () => clearTimeout(t)
  }, [])
  const [notas, setNotas] = useState(false)
  const [modal, setModal] = useState<Modal>(() => (db.profile === undefined ? 'welcome' : 'closed'))
  const [tourSeen, setTourSeen] = useState(tourVisto)
  const [instalarSheet, setInstalarSheet] = useState(false)
  // "Ofrecer instalar en cuanto se libere la pantalla". El tutorial puede terminar
  // DEJANDO algo abierto (el paso final abre el selector de estado de la primera
  // materia), y ahí la hoja se superponía con el selector: dos cosas pidiendo
  // atención sobre la misma acción.
  const [instalarPendiente, setInstalarPendiente] = useState(false)
  const nombre = db.profile?.name?.trim() || 'Mi plan de carrera'

  // el tour corre una sola vez, ya con un perfil y sin modales abiertos
  // (tampoco mientras el sync espera una decisión: consentimiento o conflicto)
  const showTour =
    modal === 'closed' &&
    db.profile !== undefined &&
    !tourSeen &&
    syncEstado !== 'consentimiento' &&
    syncEstado !== 'conflicto'
  const closeTour = () => {
    try {
      localStorage.setItem(TOUR_KEY, '1')
    } catch {
      /* modo incógnito, etc. */
    }
    setTourSeen(true)
    // El cierre del tutorial es el momento de ofrecer instalar: recién ahí la
    // persona sabe para qué sirve la app. Solo si el navegador tiene algo que
    // ofrecer y si no dijo que no. Queda PENDIENTE, no se muestra ya: el efecto
    // de más abajo espera a que no haya nada más abierto.
    if (Instalar.ofrecer()) setInstalarPendiente(true)
  }
  const cerrarInstalar = (motivo: 'luego' | 'nunca') => {
    if (motivo === 'nunca') Instalar.noOfrecerMas()
    setInstalarSheet(false)
  }

  // Quien contestó "ahora no" vuelve a verla al abrir la app. El tutorial tiene su
  // propio momento (`closeTour`), así que acá se sale si todavía va a correr: si no,
  // en la primera visita se ofrecería dos veces.
  useEffect(() => {
    if (!tourSeen) return
    const t = setTimeout(() => {
      if (Instalar.ofrecer()) setInstalarPendiente(true)
    }, INSTALAR_MS)
    return () => clearTimeout(t)
    // una sola vez por carga: si se ofreció y la pospuso, la próxima vez es la
    // próxima APERTURA, no diez segundos después
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La hoja de instalar espera su turno: aparece cuando no queda nada abierto
  // encima. Así, si el tutorial terminó abriendo el selector de la primera materia,
  // la invitación llega DESPUÉS de marcarla — que además es mejor momento.
  useEffect(() => {
    if (!instalarPendiente) return
    if (pop || notas || tree || modal !== 'closed') return
    setInstalarPendiente(false)
    setInstalarSheet(true)
  }, [instalarPendiente, pop, notas, tree, modal])

  // segundo toque sobre la misma materia → cierra (toggle)
  const togglePop = (cod: string, anchor: HTMLElement) =>
    setPop((prev) => (prev?.cod === cod ? null : { cod, anchor }))

  // aperturas instrumentadas (un solo choke point para el tracking)
  const openTree = (focus: string | null) => {
    Analytics.evento('arbol_abierto')
    setTree({ focus })
  }
  const openNotas = () => {
    Analytics.evento('notas_abierto')
    setNotas(true)
  }

  // Cierre del tour con acción: el recién llegado hace su primera marca ahí mismo.
  // `directo` = tocó la materia resaltada (su propio clic abre el selector); sin
  // `directo` vino por el botón de la tarjeta → abrimos el selector sobre la 1ª
  // materia del plan (1° año, sin correlativas). `primera_materia` se dispara solo
  // al elegir estado; `tour_marcar` mide cuántos aceptan el empujón.
  const marcarPrimera = (directo = false) => {
    Analytics.evento('tour_marcar')
    closeTour()
    if (directo) return
    const el = document.querySelector<HTMLElement>('#plan .mat')
    if (el) setPop({ cod: el.id.replace(/^mat-/, ''), anchor: el })
  }

  return (
    <>
      <div className="wrap">
        <header className="head">
          <div className="who">
            <Avatar perfil={db.profile} onClick={() => setModal('edit')} />
            <div className="who-tx">
              <h1>{nombre}</h1>
              <div className="sub">
                {PLANES.length > 1 ? (
                  <CarreraSelect
                    variant="inline"
                    value={PlanActivo.id()}
                    onChange={(id) => PlanActivo.cambiarA(id, db.profile)}
                  />
                ) : (
                  <>
                    {plan.carrera} · {nombreUniversidad(plan.def.universidad)} · plan{' '}
                    {plan.def.codigo}
                  </>
                )}
              </div>
            </div>
          </div>
          <OptionsMenu onVerTutorial={() => setTourSeen(false)} />
        </header>

        {modal === 'closed' && <SyncAviso />}


        <Dashboard db={db} onOpenTree={() => openTree(null)} onOpenNotas={openNotas} />
        <PlanView
          db={db}
          openCod={pop?.cod ?? null}
          onOpen={togglePop}
          onVerArbol={(cod) => openTree(cod)}
        />

        <div className="foot">Tu progreso se guarda automáticamente en este dispositivo.</div>

        {pop && (
          <StatePopover
            key={pop.cod}
            cod={pop.cod}
            anchor={pop.anchor}
            db={db}
            onClose={() => setPop(null)}
            onVerArbol={(cod) => openTree(cod)}
          />
        )}

        {tree && (
          <Suspense fallback={<div className="tv-cargando" aria-label="Abriendo el árbol…" />}>
            <TreeView focus={tree.focus} onClose={() => setTree(null)} />
          </Suspense>
        )}

        {showTour && <Tour pasos={PASOS_ALUMNO} onClose={closeTour} onMark={marcarPrimera} />}

        {notas && <NotasPanel onClose={() => setNotas(false)} />}

        {instalarSheet && <InstalarSheet onClose={cerrarInstalar} />}

        {modal === 'welcome' && <Welcome onClose={() => setModal('closed')} />}

        {syncEstado === 'consentimiento' && <ConsentModal />}

        {conflicto && <SyncConflicto conflicto={conflicto} />}

        {modal === 'edit' && (
          <ProfileModal welcome={false} perfil={db.profile} onClose={() => setModal('closed')} />
        )}
      </div>

      <PrintSummary />
      <Toaster />
    </>
  )
}
