// El panel del superadmin: lo único que él puede hacer y nadie más.
//
// POR QUÉ EXISTE (pedido de Luz, 12-ago): "la pantalla de permisos debería estar en el
// dashboard del superadmin, no en la universidad", y "+ Plan en otra universidad también".
//
// El motivo es más que de acomodo. Esos dos controles vivían colgados de la lista de
// planes —un botón "Permisos" en el encabezado de cada universidad, y un enlace al pie—,
// así que la lista tenía que explicar dos trabajos distintos a la vez: mantener planes (lo
// que hace un admin todos los días) y repartir accesos (lo que hace el superadmin una vez
// por facultad). Un admin de universidad ni siquiera podía ver esos botones, con lo cual
// la mitad del encabezado era espacio muerto para el 90% de las sesiones.
//
// Separados, cada pantalla contesta una sola pregunta: la lista, "¿cómo van mis planes?";
// esta, "¿quién entra y con cuánto cupo?".

import { useEffect, useState } from 'react'
import { repo, type UniversidadAdmin } from '../state/admin'
import type { PlanAdmin } from '../lib/admin'
import { Habilitados } from './Habilitados'

export function PanelSuper({
  universidades,
  planes,
  onCrearPlan,
  onCambioLimite,
  onCerrar,
}: {
  universidades: UniversidadAdmin[]
  planes: PlanAdmin[]
  /** Abre la pantalla de crear plan, apuntando a esa universidad. */
  onCrearPlan: (uni: string) => void
  /** Para que la lista de planes refresque los cupos sin recargar todo. */
  onCambioLimite: () => void
  onCerrar: () => void
}) {
  /** Universidad cuyos permisos se están viendo, o `null` = la lista. */
  const [permisos, setPermisos] = useState<string | null>(null)
  /** Cuántos admins tiene cada universidad, para no entrar a mirar de a una. */
  const [cuantos, setCuantos] = useState<Record<string, number>>({})

  // Se cuentan los habilitados de todas de una sola vez. Es una RPC por universidad, pero
  // solo la corre el superadmin y son unidades, no miles.
  useEffect(() => {
    let vivo = true
    void Promise.all(
      universidades.map(async (u) => [u.id, (await repo.cargarAdmins(u.id)).length] as const),
    )
      .then((pares) => vivo && setCuantos(Object.fromEntries(pares)))
      .catch(() => {
        /* si falla, la fila no muestra el conteo: no vale romper la pantalla por eso */
      })
    return () => {
      vivo = false
    }
  }, [universidades, permisos])

  if (permisos !== null) {
    const uni =
      universidades.find((u) => u.id === permisos) ?? new UniversidadAdminVacia(permisos)
    return (
      <Habilitados
        uni={uni}
        onCerrar={() => setPermisos(null)}
        onCambioLimite={onCambioLimite}
      />
    )
  }

  return (
    <div className="adm-card ps">
      <div className="hb-head">
        <div>
          <h2>Panel del superadmin</h2>
          <p className="cp-bajada">
            Lo que solo vos podés hacer: decidir quién entra a cada universidad y cuántos
            planes puede tener.
          </p>
        </div>
        <button className="lnk" onClick={onCerrar}>
          ← Volver a los planes
        </button>
      </div>

      <div className="ps-unis">
        <div className="cp-lbl">Universidades</div>
        {universidades.length === 0 ? (
          <p className="adm-meta">
            Todavía no hay ninguna. Se crea junto con el primer plan, desde “Plan en otra
            universidad”.
          </p>
        ) : (
          <ul className="ps-lista">
            {universidades.map((u) => {
              const suyos = planes.filter((p) => p.universidad_id === u.id).length
              const admins = cuantos[u.id]
              return (
                <li className="ps-uni" key={u.id}>
                  <div className="ps-uni-id">
                    <span className="adm-carrera">{u.nombre}</span>
                    <code className="adm-id">{u.id}</code>
                  </div>
                  <span className="adm-meta ps-cupo">
                    {suyos} de {u.limite_planes} planes
                  </span>
                  <span className="adm-meta ps-admins">
                    {admins === undefined
                      ? ''
                      : admins === 0
                        ? 'sin admins'
                        : `${admins} admin${admins === 1 ? '' : 's'}`}
                  </span>
                  <button
                    className="adm-permisos"
                    onClick={() => setPermisos(u.id)}
                    title={`Quién entra a ${u.nombre} y con cuánto cupo`}
                  >
                    Permisos y cupo
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Estaba al pie de la lista de planes, donde solo lo veía el superadmin y le comía
          espacio a todos los demás. Acá es una de las dos cosas que esta pantalla hace. */}
      <div className="ps-acciones">
        <button className="btn" onClick={() => onCrearPlan(universidades[0]?.id ?? '')}>
          + Plan en otra universidad
        </button>
        <p className="cp-ayuda">
          Desde ahí también se da de alta una universidad nueva, que es lo que hace falta
          para cargar una carrera de una facultad que todavía no está.
        </p>
      </div>
    </div>
  )
}

/** Una universidad que la lista todavía no trajo: mejor mostrar el id que romper. */
class UniversidadAdminVacia {
  readonly id: string
  readonly nombre: string
  readonly limite_planes = 0

  constructor(id: string) {
    this.id = id
    this.nombre = id
  }
}
