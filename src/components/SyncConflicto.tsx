import { resolverConflicto, type Conflicto } from '../state/sync'

/**
 * Modal de conflicto del sync: la nube y la memoria local tienen progreso
 * distinto y la app no puede decidir sola sin perder datos. Aparece solo la
 * primera vez que la cuenta se usa en un dispositivo que ya tenía avance, o si
 * los dos lados avanzaron a la vez (lo cotidiano se resuelve solo con la base
 * de última sincronización). No se puede cerrar sin elegir — mientras tanto no
 * se sube nada.
 */
export function SyncConflicto({ conflicto }: { conflicto: Conflicto }) {
  return (
    <div className="modal show">
      <div className="sheet">
        <h2>Hay dos avances distintos</h2>
        <p className="m-desc">
          La nube de tu cuenta tiene un avance guardado y la memoria de este
          dispositivo tiene otro. Elegí con cuál seguir — el otro se reemplaza.
        </p>

        <div className="conf-opts">
          <button className="conf-opt" onClick={() => resolverConflicto('nube')}>
            <b>Usar el de la nube</b>
            <small>
              {conflicto.marcadasCuenta} materia{conflicto.marcadasCuenta === 1 ? '' : 's'} con
              carga · reemplaza la memoria local
            </small>
          </button>
          <button className="conf-opt" onClick={() => resolverConflicto('local')}>
            <b>Usar la memoria local</b>
            <small>
              {conflicto.marcadasLocal} materia{conflicto.marcadasLocal === 1 ? '' : 's'} con
              carga · reemplaza lo de la nube
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
