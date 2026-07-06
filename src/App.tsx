import { useState } from 'react'
import { useDB } from './state/store'
import { Avatar } from './components/Avatar'
import { Dashboard } from './components/Dashboard'
import { NotasPanel } from './components/NotasPanel'
import { OptionsMenu } from './components/OptionsMenu'
import { PlanView } from './components/PlanView'
import { PrintSummary } from './components/PrintSummary'
import { ProfileModal } from './components/ProfileModal'
import { StatePopover } from './components/StatePopover'
import { Toaster } from './components/Toaster'
import { TreeView } from './components/Tree/TreeView'
import { track } from './lib/analytics'

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
  const nombre = db.profile?.name?.trim() || 'Mi plan de carrera'

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
              <div className="sub">Ingeniería en Informática · UADE</div>
            </div>
          </div>
          <div className="head-right">
            <span className="spine">Plan 1621 — 2021</span>
            <button className="tool-btn" onClick={() => openTree(null)} title="Ver árbol de correlativas">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="5" rx="1.2" />
                <rect x="3" y="16" width="6" height="5" rx="1.2" />
                <rect x="15" y="16" width="6" height="5" rx="1.2" />
                <path d="M12 8v3M6 16v-2.5h12V16" />
              </svg>
              Árbol de correlativas
            </button>
            <button className="tool-btn" onClick={openNotas} title="Notas y promedio">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M9 8h6M9 12h6M9 16h4" />
              </svg>
              Notas
            </button>
            <OptionsMenu />
          </div>
        </header>

        <Dashboard db={db} />
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

        {notas && <NotasPanel onClose={() => setNotas(false)} />}

        {modal !== 'closed' && (
          <ProfileModal
            welcome={modal === 'welcome'}
            perfil={db.profile}
            onClose={() => setModal('closed')}
          />
        )}
      </div>

      <PrintSummary />
      <Toaster />
    </>
  )
}
