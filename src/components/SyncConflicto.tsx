import { resolverConflicto, type Conflicto } from '../state/sync'

/**
 * Modal de conflicto del sync: la cuenta y este dispositivo tienen progreso
 * distinto y la app no decide sola (regla de oro: nunca pisar sin preguntar).
 * No se puede cerrar sin elegir — mientras tanto no se sube nada.
 */
export function SyncConflicto({ conflicto }: { conflicto: Conflicto }) {
  return (
    <div className="modal show">
      <div className="sheet">
        <h2>Encontramos avance en tu cuenta</h2>
        <p className="m-desc">
          Tu cuenta ya tiene progreso guardado y este dispositivo también, pero no
          coinciden. Elegí con cuál seguir — el otro se reemplaza.
        </p>

        <div className="conf-opts">
          <button className="conf-opt" onClick={() => resolverConflicto('cuenta')}>
            <b>Usar el de mi cuenta</b>
            <small>
              {conflicto.marcadasCuenta} materia{conflicto.marcadasCuenta === 1 ? '' : 's'} con
              carga · reemplaza lo de este dispositivo
            </small>
          </button>
          <button className="conf-opt" onClick={() => resolverConflicto('dispositivo')}>
            <b>Usar el de este dispositivo</b>
            <small>
              {conflicto.marcadasLocal} materia{conflicto.marcadasLocal === 1 ? '' : 's'} con
              carga · reemplaza lo guardado en la cuenta
            </small>
          </button>
        </div>

        <p className="conf-hint">
          Tip: si no estás segura, exportá antes un backup desde Opciones.
        </p>
      </div>
    </div>
  )
}
