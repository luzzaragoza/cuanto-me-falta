import { useState } from 'react'
import { useDB } from './state/store'
import { hitos } from './domain/selectors'
import { plan } from './domain/Plan'
import { nombreUniversidad } from './data/planes'
import { Avatar } from './components/Avatar'
import { Dashboard } from './components/Dashboard'
import { NotasPanel } from './components/NotasPanel'
import { OptionsMenu } from './components/OptionsMenu'
import { PlanView } from './components/PlanView'
import { PrintSummary } from './components/PrintSummary'
import { ProfileModal } from './components/ProfileModal'
import { StatePopover } from './components/StatePopover'
import { Toaster } from './components/Toaster'
import { Welcome } from './components/Welcome'
import { TreeView } from './components/Tree/TreeView'
import { Tour } from './components/Tour'
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
  const [pop, setPop] = useState<PopState | null>(null)
  const [tree, setTree] = useState<{ focus: string | null } | null>(null)
  const [notas, setNotas] = useState(false)
  const [modal, setModal] = useState<Modal>(() => (db.profile === undefined ? 'welcome' : 'closed'))
  const [tourSeen, setTourSeen] = useState(tourVisto)
  const nombre = db.profile?.name?.trim() || 'Mi plan de carrera'
  const titulos = hitos(db) // Analista / Ingeniero → chips de progreso en el header

  // el tour corre una sola vez, ya con un perfil y sin modales abiertos
  const showTour = modal === 'closed' && db.profile !== undefined && !tourSeen
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

  return (
    <>
      <div className="wrap">
        <header className="head">
          <div className="who">
            <Avatar perfil={db.profile} onClick={() => setModal('edit')} />
            <div>
              <h1>{nombre}</h1>
              <div className="sub">
                {plan.carrera} · {nombreUniversidad(plan.def.universidad)}
              </div>
            </div>
          </div>
          <div className="head-right">
            <span className="spine">
              Plan {plan.def.codigo} — {plan.def.anio}
            </span>
            <div className="title-chips">
              {titulos.map((t, i) => (
                <span className={'title-chip' + (t.ok ? ' ok' : '')} key={t.titulo}>
                  <span className="tc-n">{t.ok ? '✓' : i + 1}</span>
                  <span className="tc-t">{t.titulo.split(' ')[0]}</span>
                  <span className="tc-r">{t.ok ? 'listo' : `faltan ${t.falta}`}</span>
                </span>
              ))}
            </div>
            <OptionsMenu onVerTutorial={() => setTourSeen(false)} />
          </div>
        </header>

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

        {tree && <TreeView focus={tree.focus} onClose={() => setTree(null)} />}

        {showTour && <Tour onClose={closeTour} />}

        {notas && <NotasPanel onClose={() => setNotas(false)} />}

        {modal === 'welcome' && <Welcome onClose={() => setModal('closed')} />}

        {modal === 'edit' && (
          <ProfileModal welcome={false} perfil={db.profile} onClose={() => setModal('closed')} />
        )}
      </div>

      <PrintSummary />
      <Toaster />
    </>
  )
}
