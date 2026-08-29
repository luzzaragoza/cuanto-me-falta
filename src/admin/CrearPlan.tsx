// Crear un plan (y, si sos superadmin, la universidad que lo va a alojar).
//
// La pantalla que hace posible el Gate C: cargar una carrera de una universidad ajena a
// UADE sin tocar código ni hacer un deploy.
//
// Dos decisiones de diseño que gobiernan el formulario:
//
//  · **El `id` se sugiere, y se puede editar.** Es PERMANENTE —es la clave con la que
//    cada alumno tiene guardado su progreso en el dispositivo (`plan-<id>-v3`)— así que
//    renombrarlo después dejaría huérfano el avance de todos, y la migración 005 no lo
//    cascadea a propósito. Justamente por eso es editable ACÁ: este es el único momento
//    de su vida en que se puede elegir. Concatenar dos nombres largos daba cosas como
//    `universidad-tecnologica-nacional-ingenieria-en-sistemas-de-informacion`, y eso
//    quedaba para siempre.
//  · **Los problemas se listan mientras escribís, y no bloquean campo por campo.** El
//    botón se deshabilita, pero los cuatro campos quedan siempre editables: un
//    formulario que te traba el foco hasta completar el anterior es exactamente lo que
//    hace lento cargar datos.

import { useState } from 'react'
import { PlanNuevo, UniversidadNueva, type SesionAdmin } from '../lib/admin'
import { repo, type UniversidadAdmin } from '../state/admin'

const ANIO_ACTUAL = new Date().getFullYear()

export function CrearPlan({
  sesion,
  universidades,
  uniInicial,
  idsExistentes,
  onCancelar,
  onCreado,
}: {
  sesion: SesionAdmin
  universidades: UniversidadAdmin[]
  /** La universidad desde cuya sección se apretó "+ Plan nuevo". */
  uniInicial: string
  /** Ids de plan ya usados, para no sugerir uno repetido. */
  idsExistentes: string[]
  onCancelar: () => void
  onCreado: (planId: string) => void
}) {
  // Un admin solo puede crear en las suyas; el superadmin, en todas.
  const disponibles = sesion.esSuper
    ? universidades
    : universidades.filter((u) => sesion.universidades.includes(u.id))

  const [uni, setUni] = useState(uniInicial)
  const [carrera, setCarrera] = useState('')
  const [codigo, setCodigo] = useState('')
  const [anio, setAnio] = useState(String(ANIO_ACTUAL))
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** `null` = seguir el sugerido; un string = lo escribió la persona. */
  const [idPropio, setIdPropio] = useState<string | null>(null)

  // ── universidad nueva (solo superadmin) ──
  const [uniNueva, setUniNueva] = useState(false)
  const [uniNombre, setUniNombre] = useState('')
  const [uniLimite, setUniLimite] = useState('5')
  const [uniIdPropio, setUniIdPropio] = useState<string | null>(null)

  const nueva = new UniversidadNueva(uniNombre, Number(uniLimite), uniIdPropio ?? undefined)
  const problemasUni = uniNueva ? nueva.problemas(universidades.map((u) => u.id)) : []

  const plan = new PlanNuevo({
    universidad: uniNueva ? nueva.id : uni,
    carrera,
    codigo,
    anio: Number(anio),
  })
  const problemas = plan.problemas(ANIO_ACTUAL)
  const idSugerido = plan.idSugerido(idsExistentes)
  const id = idPropio ?? idSugerido
  const problemasId = PlanNuevo.problemasDeId(id, idsExistentes)
  const listo =
    problemas.length === 0 && problemasUni.length === 0 && problemasId.length === 0

  const crear = async (): Promise<void> => {
    setCreando(true)
    setError(null)
    try {
      // La universidad primero: el plan la referencia por FK, así que si esto falla no
      // tiene sentido seguir.
      if (uniNueva) {
        await repo.crearUniversidad({
          id: nueva.id,
          nombre: nueva.nombre.trim(),
          limite_planes: nueva.limitePlanes,
        })
      }
      await repo.crearPlan({
        id: id.trim(),
        universidad: uniNueva ? nueva.id : uni,
        codigo: codigo.trim(),
        anio: Number(anio),
        carrera: carrera.trim(),
      })
      onCreado(id.trim())
    } catch (e) {
      setCreando(false)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="adm-card cp">
      <div className="cp-head">
        <h2>Crear un plan de estudios</h2>
        <p className="cp-bajada">
          Queda en borrador: los alumnos no lo ven hasta que lo publiques.
        </p>
      </div>

      <div className="cp-campos">
        <label className="cp-campo">
          <span className="cp-lbl">Universidad</span>
          {uniNueva ? (
            <div className="cp-uni-nueva">
              <input
                className="cp-in"
                value={uniNombre}
                onChange={(e) => setUniNombre(e.target.value)}
                placeholder="Nombre completo de la universidad"
                aria-label="Nombre de la universidad nueva"
                autoFocus
              />
              <div className="cp-sub">
                <label className="cp-campo">
                  <span className="cp-lbl">Su identificador</span>
                  <input
                    className="cp-in cp-in-mono"
                    value={uniIdPropio ?? nueva.idSugerido}
                    onChange={(e) => setUniIdPropio(e.target.value)}
                    aria-label="Identificador de la universidad"
                  />
                  <span className="cp-ayuda">Corto: es el prefijo de todos sus planes</span>
                </label>
                <label className="cp-campo">
                  <span className="cp-lbl">Planes que puede tener</span>
                  <input
                    className="cp-in cp-in-num"
                    type="number"
                    min={1}
                    value={uniLimite}
                    onChange={(e) => setUniLimite(e.target.value)}
                    aria-label="Límite de planes"
                  />
                  <span className="cp-ayuda">Lo que diga el contrato</span>
                </label>
              </div>
              <button className="lnk" onClick={() => setUniNueva(false)}>
                ← Elegir una que ya existe
              </button>
            </div>
          ) : (
            <div className="cp-uni-elegir">
              <select
                className="cp-in"
                value={uni}
                onChange={(e) => setUni(e.target.value)}
                aria-label="Universidad"
              >
                {disponibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
              {sesion.esSuper && (
                <button className="lnk" onClick={() => setUniNueva(true)}>
                  + Universidad nueva
                </button>
              )}
            </div>
          )}
        </label>

        <label className="cp-campo">
          <span className="cp-lbl">Carrera</span>
          <input
            className="cp-in"
            value={carrera}
            onChange={(e) => setCarrera(e.target.value)}
            placeholder="Nombre completo de la carrera"
            aria-label="Nombre de la carrera"
          />
        </label>

        <div className="cp-fila">
          <label className="cp-campo">
            <span className="cp-lbl">Código del plan</span>
            <input
              className="cp-in"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="—"
              aria-label="Código del plan"
            />
            <span className="cp-ayuda">El que usa la facultad</span>
          </label>
          <label className="cp-campo">
            <span className="cp-lbl">Año de vigencia</span>
            <input
              className="cp-in cp-in-num"
              type="number"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              aria-label="Año de vigencia del plan"
            />
            <span className="cp-ayuda">Desde cuándo rige</span>
          </label>
        </div>
      </div>

      {/* El id es lo único irreversible de esta pantalla: se muestra aparte y con su
          advertencia, no escondido entre los campos. */}
      <label className="cp-id">
        <span className="cp-lbl">Identificador permanente</span>
        <input
          className="cp-in cp-in-mono"
          value={id}
          onChange={(e) => setIdPropio(e.target.value)}
          aria-label="Identificador permanente del plan"
        />
        <p className="cp-ayuda">
          <strong>No se puede cambiar después</strong>: es la clave con la que cada alumno
          guarda su avance en su dispositivo. Se sugiere uno a partir de lo que escribiste;
          este es el único momento en que podés elegirlo.
          {idPropio !== null && idPropio !== idSugerido && (
            <>
              {' '}
              <button className="lnk" onClick={() => setIdPropio(null)}>
                Volver al sugerido
              </button>
            </>
          )}
        </p>
      </label>

      {(problemasUni.length > 0 || problemas.length > 0 || problemasId.length > 0) && (
        <ul className="cp-faltan">
          {[...problemasUni, ...problemas, ...problemasId].map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {error && (
        <div className="adm-error">
          <div>
            <strong>No pude crearlo.</strong> {error}
          </div>
        </div>
      )}

      <div className="cp-acciones">
        <button className="lnk" onClick={onCancelar} disabled={creando}>
          Cancelar
        </button>
        <button className="btn" onClick={() => void crear()} disabled={!listo || creando}>
          {creando ? 'Creando…' : 'Crear y empezar a cargar'}
        </button>
      </div>
    </div>
  )
}
