import { useState } from 'react'
import { useDB } from './state/store'
import { Dashboard } from './components/Dashboard'
import { PlanView } from './components/PlanView'
import { StatePopover } from './components/StatePopover'
import { TreeView } from './components/Tree/TreeView'

interface PopState {
  cod: string
  anchor: HTMLElement
}

export function App() {
  const db = useDB()
  const [pop, setPop] = useState<PopState | null>(null)
  const [tree, setTree] = useState(false)
  const nombre = db.profile?.name?.trim() || 'Mi plan de carrera'

  // segundo toque sobre la misma materia → cierra (toggle)
  const togglePop = (cod: string, anchor: HTMLElement) =>
    setPop((prev) => (prev?.cod === cod ? null : { cod, anchor }))

  return (
    <div className="wrap">
      <header className="head">
        <div>
          <h1>{nombre}</h1>
          <div className="sub">Ingeniería en Informática · UADE</div>
        </div>
        <div className="head-right">
          <span className="spine">Plan 1621 — 2021</span>
          <button className="tool-btn" onClick={() => setTree(true)} title="Ver árbol de correlativas">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="5" rx="1.2" />
              <rect x="3" y="16" width="6" height="5" rx="1.2" />
              <rect x="15" y="16" width="6" height="5" rx="1.2" />
              <path d="M12 8v3M6 16v-2.5h12V16" />
            </svg>
            Árbol
          </button>
        </div>
      </header>

      <Dashboard db={db} />
      <PlanView db={db} openCod={pop?.cod ?? null} onOpen={togglePop} />

      <div className="foot">Tu progreso se guarda automáticamente en este dispositivo.</div>

      {pop && (
        <StatePopover
          key={pop.cod}
          cod={pop.cod}
          anchor={pop.anchor}
          db={db}
          onClose={() => setPop(null)}
        />
      )}

      {tree && <TreeView onClose={() => setTree(false)} />}
    </div>
  )
}
