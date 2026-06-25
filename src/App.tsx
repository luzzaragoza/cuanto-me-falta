import { useState } from 'react'
import { useDB } from './state/store'
import { Dashboard } from './components/Dashboard'
import { PlanView } from './components/PlanView'
import { StatePopover } from './components/StatePopover'

interface PopState {
  cod: string
  anchor: HTMLElement
}

export function App() {
  const db = useDB()
  const [pop, setPop] = useState<PopState | null>(null)
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
        <span className="spine">Plan 1621 — 2021</span>
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
    </div>
  )
}
