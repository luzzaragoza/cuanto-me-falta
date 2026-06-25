import { useDB } from './state/store'
import { Dashboard } from './components/Dashboard'
import { PlanView } from './components/PlanView'

export function App() {
  const db = useDB()
  const nombre = db.profile?.name?.trim() || 'Mi plan de carrera'

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
      <PlanView db={db} />

      <div className="foot">Tu progreso se guarda automáticamente en este dispositivo.</div>
    </div>
  )
}
