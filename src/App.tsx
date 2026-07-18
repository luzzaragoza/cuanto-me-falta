import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { store, useDB } from './state/store'
import { useSession } from './state/auth'
import { photoFromUrl } from './lib/image'
import { plan } from './domain/Plan'
import { PLANES, nombreUniversidad } from './data/planes'
import { cambiarAPlan, planActivoId } from './state/planActivo'
import { Avatar } from './components/Avatar'
import { CarreraSelect } from './components/CarreraSelect'
import { Dashboard } from './components/Dashboard'
import { NotasPanel } from './components/NotasPanel'
import { OptionsMenu } from './components/OptionsMenu'
import { PlanView } from './components/PlanView'
import { PrintSummary } from './components/PrintSummary'
import { ProfileModal } from './components/ProfileModal'
import { InstallAviso } from './components/InstallAviso'
import { StatePopover } from './components/StatePopover'
import { SyncAviso } from './components/SyncAviso'
import { SyncConflicto } from './components/SyncConflicto'
import { ConsentModal } from './components/ConsentModal'
import { getConflicto, useSyncEstado } from './state/sync'
import { Toaster } from './components/Toaster'
import { Welcome } from './components/Welcome'
import { Tour } from './components/Tour'

// El árbol vive en un chunk aparte (elkjs + React Flow pesan ~medio MB gz y no
// hacen falta para abrir la app). Se precalienta en idle (abajo) así la primera
// apertura es instantánea y el service worker lo deja cacheado para offline.
const TreeView = lazy(() =>
  import('./components/Tree/TreeView').then((m) => ({ default: m.TreeView })),
)
import { track } from './lib/analytics'

const TOUR_KEY = 'cmf-tour-visto'
const tourVisto = () => {
  try {
    return !!localStorage.getItem(TOUR_KEY)
  } catch {
    return true
  }
}

interface PopState {
  cod: string
  anchor: HTMLElement
}

type Modal = 'closed' | 'welcome' | 'edit'

export function App() {
  const db = useDB()
  const session = useSession()
  const syncEstado = useSyncEstado()
  const conflicto = syncEstado === 'conflicto' ? getConflicto() : null

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
    void photoFromUrl(meta.avatar_url).then((photo) => {
      if (!photo) return
      const name = perfil.name || (meta.full_name || meta.name || '').trim()
      store.setPerfil({ name, photo })
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
  }

  // segundo toque sobre la misma materia → cierra (toggle)
  const togglePop = (cod: string, anchor: HTMLElement) =>
    setPop((prev) => (prev?.cod === cod ? null : { cod, anchor }))

  // aperturas instrumentadas (un solo choke point para el tracking)
  const openTree = (focus: string | null) => {
    track('arbol_abierto')
    setTree({ focus })
  }
  const openNotas = () => {
    track('notas_abierto')
    setNotas(true)
  }

  // Cierre del tour con acción: el recién llegado hace su primera marca ahí mismo.
  // `directo` = tocó la materia resaltada (su propio clic abre el selector); sin
  // `directo` vino por el botón de la tarjeta → abrimos el selector sobre la 1ª
  // materia del plan (1° año, sin correlativas). `primera_materia` se dispara solo
  // al elegir estado; `tour_marcar` mide cuántos aceptan el empujón.
  const marcarPrimera = (directo = false) => {
    track('tour_marcar')
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
                    value={planActivoId()}
                    onChange={(id) => cambiarAPlan(id, db.profile)}
                  />
                ) : (
                  <>
                    {plan.carrera} · {nombreUniversidad(plan.def.universidad)}
                  </>
                )}
              </div>
            </div>
          </div>
          <OptionsMenu onVerTutorial={() => setTourSeen(false)} />
        </header>

        {modal === 'closed' && <SyncAviso />}
        {modal === 'closed' && <InstallAviso />}

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

        {showTour && <Tour onClose={closeTour} onMark={marcarPrimera} />}

        {notas && <NotasPanel onClose={() => setNotas(false)} />}

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
