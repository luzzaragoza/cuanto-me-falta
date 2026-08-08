// Editor de un plan de estudios. Tres pestañas (estructura · correlativas · títulos) y
// un panel de publicación.
//
// Decisiones de Luz que gobiernan esta pantalla:
//  · Materias INLINE en la grilla: clic y escribís, Tab al siguiente. Es lo único que
//    cumple el Gate C (una carrera de ~40 materias en menos de 2 horas).
//  · Correlativas TILDANDO de una lista que solo ofrece cuatrimestres anteriores, así no
//    se puede cargar una flecha imposible, con la cadena redibujándose al lado.
//  · AUTOGUARDADO en el borrador: como el borrador es invisible para los alumnos hasta
//    que se publica, guardar seguido no tiene riesgo — y no se puede perder una hora de
//    carga por cerrar la pestaña. Se guarda al salir del campo (Tab ya commitea) y
//    además con un retardo corto mientras escribís.

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TituloPlan } from '../data/model'
import { Plan } from '../domain/Plan'
import {
  agregarMateria,
  alternarPrevia,
  aniosDe,
  aPlanDef,
  codigoRepetido,
  dependenDe,
  editarMateria,
  elegiblesComoPosterior,
  elegiblesComoPrevia,
  guardable,
  moverMateria,
  ordenar,
  previasDe,
  quitarMateria,
  renombrarCodigo,
  resumen,
  type Borrador,
  type MateriaEdit,
} from '../lib/editorPlan'
import { validarPlan } from '../lib/validarPlan'
import {
  borrarMateria,
  cargarBorrador,
  cargarVersiones,
  guardarMateria,
  guardarPrevias,
  guardarTitulos,
  publicarPlan,
  revertirPlan,
} from '../state/admin'

// El árbol vive en su propio chunk (pesa: trae el motor de layout). Solo lo baja quien
// entra a cargar correlativas.
const TreeView = lazy(() =>
  import('../components/Tree/TreeView').then((m) => ({ default: m.TreeView })),
)

type Pestania = 'estructura' | 'correlativas' | 'titulos'
type Direccion = 'anterior' | 'posterior'
type Guardado = 'limpio' | 'guardando' | 'guardado' | 'error'

const DEMORA_GUARDADO = 1200

export function EditorPlan({
  planId,
  puedeEditar,
  onVolver,
}: {
  planId: string
  puedeEditar: boolean
  onVolver: () => void
}) {
  const [b, setB] = useState<Borrador | null>(null)
  const [pestania, setPestania] = useState<Pestania>('estructura')
  const [guardado, setGuardado] = useState<Guardado>('limpio')
  const [error, setError] = useState<string | null>(null)
  const [objetivo, setObjetivo] = useState<string | null>(null)
  const [direccion, setDireccion] = useState<Direccion>('anterior')
  const [arbol, setArbol] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [nota, setNota] = useState('')
  const [versiones, setVersiones] = useState<
    Array<{ version: number; publicado_at: string; nota: string | null }>
  >([])
  const timers = useRef(new Map<number, number>())

  useEffect(() => {
    let vivo = true
    cargarBorrador(planId)
      .then((bo) => {
        if (!vivo) return
        setB(bo)
        return cargarVersiones(planId).then((vs) => vivo && setVersiones(vs))
      })
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      vivo = false
    }
  }, [planId])

  /** Corre una escritura mostrando el estado, sin tirar nunca. */
  const correr = useCallback(async (fn: () => Promise<void>) => {
    setGuardado('guardando')
    try {
      await fn()
      setGuardado('guardado')
      setError(null)
    } catch (e) {
      setGuardado('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  /** Guarda una materia si ya tiene lo mínimo; si no, no molesta. */
  const guardarFila = useCallback(
    (m: MateriaEdit) => {
      if (!guardable(m)) return
      void correr(async () => {
        await guardarMateria(planId, m)
        // tras el primer guardado deja de ser nueva y su código pasa a ser el de la base
        setB((prev) =>
          prev
            ? {
                ...prev,
                materias: prev.materias.map((x) =>
                  x.orden === m.orden ? { ...x, nueva: false, codOriginal: m.cod.trim() } : x,
                ),
              }
            : prev,
        )
      })
    },
    [correr, planId],
  )

  /** Programa el guardado de una fila (mientras se escribe). */
  const guardarConDemora = useCallback(
    (m: MateriaEdit) => {
      const previo = timers.current.get(m.orden)
      if (previo) clearTimeout(previo)
      timers.current.set(
        m.orden,
        window.setTimeout(() => {
          timers.current.delete(m.orden)
          guardarFila(m)
        }, DEMORA_GUARDADO),
      )
    },
    [guardarFila],
  )

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  // ── derivados del árbol-editor ──
  // Van ACÁ, antes de los early returns: los hooks no pueden ser condicionales.
  // El plan se rearma en cada cambio a propósito: así el esqueleto del árbol se
  // actualiza mientras conectás.
  const planDelBorrador = useMemo(() => (b ? new Plan(aPlanDef(b)) : null), [b])
  const elegiblesAhora = useMemo(() => {
    if (!b) return new Set<string>()
    if (!objetivo) return new Set(b.materias.filter((m) => m.cod.trim()).map((m) => m.cod))
    const lista =
      direccion === 'anterior'
        ? elegiblesComoPrevia(b, objetivo)
        : elegiblesComoPosterior(b, objetivo)
    return new Set(lista.map((m) => m.cod))
  }, [b, objetivo, direccion])
  const conectadasAhora = useMemo(() => {
    if (!b || !objetivo) return new Set<string>()
    return new Set(direccion === 'anterior' ? previasDe(b, objetivo) : dependenDe(b, objetivo))
  }, [b, objetivo, direccion])

  if (error && !b) {
    return (
      <div className="adm-card adm-vacio">
        <h2>No pude abrir el plan</h2>
        <p>{error}</p>
        <button className="lnk" onClick={onVolver}>
          ← Volver a mis planes
        </button>
      </div>
    )
  }
  if (!b) return <div className="adm-card adm-vacio">Abriendo el plan…</div>

  const plan = aPlanDef(b)
  const hallazgos = validarPlan(plan)
  const errores = hallazgos.filter((h) => h.severidad === 'error')
  const avisos = hallazgos.filter((h) => h.severidad === 'aviso')
  const cuenta = resumen(b)
  const anios = aniosDe(b)
  const materias = ordenar(b.materias)

  const cambiar = (nuevo: Borrador): void => setB(nuevo)

  const opcionesCuatri = (anios.length ? anios : [1]).flatMap((a) =>
    [1, 2].map((c) => ({ valor: `${a}-${c}`, texto: `${a}° · ${c}°C` })),
  )

  return (
    <div className="ed">
      {/* ── barra del editor ── */}
      <div className="ed-bar">
        <button className="lnk" onClick={onVolver}>
          ← Mis planes
        </button>
        <div className="ed-quees">
          <strong>{b.carrera}</strong>
          <span className="adm-meta">
            plan {b.codigo} · {b.anio} · {cuenta.materias} materias · {cuenta.correlativas}{' '}
            correlativas
          </span>
        </div>
        <div className="ed-estado">
          {guardado === 'guardando' && <span className="ed-sav">Guardando…</span>}
          {guardado === 'guardado' && <span className="ed-sav ok">✓ Borrador guardado</span>}
          {guardado === 'error' && <span className="ed-sav mal">✗ No se guardó</span>}
        </div>
      </div>

      {error && (
        <div className="adm-error">
          <div>
            <strong>Error al guardar.</strong> {error}
          </div>
          <button className="lnk" onClick={() => setError(null)}>
            Entendido
          </button>
        </div>
      )}

      {!puedeEditar && (
        <div className="ed-solo-lectura">
          Estás viendo este plan en <strong>solo lectura</strong>: tu cuenta no tiene permiso de
          edición en esta universidad.
        </div>
      )}

      <div className="ed-tabs" role="tablist">
        {(
          [
            ['estructura', `Estructura · ${cuenta.materias}`],
            ['correlativas', `Correlativas · ${cuenta.correlativas}`],
            ['titulos', `Títulos · ${cuenta.titulos}`],
          ] as Array<[Pestania, string]>
        ).map(([id, texto]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestania === id}
            className={`ed-tab ${pestania === id ? 'activa' : ''}`}
            onClick={() => setPestania(id)}
          >
            {texto}
          </button>
        ))}
      </div>

      {/* ── ESTRUCTURA ── */}
      {pestania === 'estructura' && (
        <div className="ed-cuerpo">
          {anios.length === 0 && (
            <p className="adm-meta">
              El plan está vacío. Agregá el primer año para empezar a cargar materias.
            </p>
          )}
          {anios.map((anio) => (
            <section className="ed-anio" key={anio}>
              <h3>{anio}° año</h3>
              {[1, 2].map((cuatri) => {
                const filas = materias.filter((m) => m.anio === anio && m.cuatri === cuatri)
                return (
                  <div className="ed-cuatri" key={cuatri}>
                    <div className="ed-cuatri-tit">{cuatri}° cuatrimestre</div>
                    {filas.map((m) => {
                      const dup = codigoRepetido(b, m.cod, m.orden)
                      return (
                        <div className={`ed-fila ${dup ? 'dup' : ''}`} key={m.orden}>
                          <input
                            className="ed-cod"
                            value={m.cod}
                            placeholder="código"
                            disabled={!puedeEditar}
                            aria-label="Código de la materia"
                            onChange={(e) => cambiar(renombrarCodigo(b, m.orden, e.target.value))}
                            onBlur={() => guardarFila({ ...m, cod: m.cod })}
                          />
                          <input
                            className="ed-nom"
                            value={m.nom}
                            placeholder="nombre de la materia"
                            disabled={!puedeEditar}
                            aria-label="Nombre de la materia"
                            onChange={(e) => {
                              const nuevo = editarMateria(b, m.orden, { nom: e.target.value })
                              cambiar(nuevo)
                              guardarConDemora({ ...m, nom: e.target.value })
                            }}
                            onBlur={() => guardarFila(m)}
                          />
                          <select
                            className="ed-mover"
                            value={`${m.anio}-${m.cuatri}`}
                            disabled={!puedeEditar}
                            aria-label="Año y cuatrimestre"
                            onChange={(e) => {
                              const [a, c] = e.target.value.split('-').map(Number)
                              const { borrador, rotas } = moverMateria(b, m.orden, a, c)
                              if (
                                rotas.length &&
                                !confirm(
                                  `Moverla deja ${rotas.length} correlativa(s) imposible(s):\n` +
                                    rotas.map((r) => `${r.cod} ← ${r.requiere}`).join('\n') +
                                    '\n\n¿Moverla igual? Vas a tener que corregirlas antes de publicar.',
                                )
                              ) {
                                return
                              }
                              cambiar(borrador)
                              guardarFila({ ...m, anio: a, cuatri: c })
                            }}
                          >
                            {opcionesCuatri.map((o) => (
                              <option key={o.valor} value={o.valor}>
                                {o.texto}
                              </option>
                            ))}
                          </select>
                          <button
                            className={`ed-chip ${m.opt ? 'on' : ''}`}
                            disabled={!puedeEditar}
                            title="Optativa: el alumno le pone el nombre. No participa de correlativas."
                            onClick={() => {
                              const nuevo = editarMateria(b, m.orden, { opt: !m.opt })
                              cambiar(nuevo)
                              guardarFila({ ...m, opt: !m.opt })
                            }}
                          >
                            OPT
                          </button>
                          <button
                            className={`ed-chip ${m.especial ? 'on' : ''}`}
                            disabled={!puedeEditar}
                            title="Se habilita por requisito especial (por año o % de carrera), no por correlativa."
                            onClick={() => {
                              const nuevo = editarMateria(b, m.orden, { especial: !m.especial })
                              cambiar(nuevo)
                              guardarFila({ ...m, especial: !m.especial })
                            }}
                          >
                            ESP
                          </button>
                          <button
                            className="ed-borrar"
                            disabled={!puedeEditar}
                            title="Borrar la materia"
                            onClick={() => {
                              const dependen = dependenDe(b, m.cod)
                              const aviso = dependen.length
                                ? `\n\nOjo: ${dependen.join(', ')} la tienen como previa. Esas correlativas se borran también.`
                                : ''
                              if (!confirm(`¿Borrar ${m.cod || 'esta materia'}?${aviso}`)) return
                              cambiar(quitarMateria(b, m.orden))
                              if (m.codOriginal) {
                                void correr(() => borrarMateria(planId, m.codOriginal!))
                              }
                            }}
                          >
                            ✕
                          </button>
                          {dup && <span className="ed-dup">código repetido</span>}
                        </div>
                      )
                    })}
                    {puedeEditar && (
                      <button
                        className="ed-add"
                        onClick={() => cambiar(agregarMateria(b, anio, cuatri).borrador)}
                      >
                        + materia
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
          {puedeEditar && (
            <button
              className="ed-add-anio"
              onClick={() =>
                cambiar(agregarMateria(b, (anios.at(-1) ?? 0) + 1, 1).borrador)
              }
            >
              + agregar {(anios.at(-1) ?? 0) + 1}° año
            </button>
          )}
        </div>
      )}

      {/* ── CORRELATIVAS ── */}
      {pestania === 'correlativas' && (
        <div className="ed-cuerpo">
          <div className="ed-invita">
            <div>
              <h3>Las correlativas se cargan sobre el árbol</h3>
              <p>
                Elegís una materia, elegís si querés cargar lo que <strong>necesita</strong> o
                lo que <strong>habilita</strong>, y vas tocando materias: las que se pueden
                conectar se iluminan. Los colores son los mismos que ven los alumnos —{' '}
                <span className="ed-leyenda previa">violeta lo que necesita</span>,{' '}
                <span className="ed-leyenda habilita">teal lo que habilita</span>.
              </p>
            </div>
            <button className="btn" onClick={() => setArbol(true)}>
              Abrir el árbol
            </button>
          </div>

          <div className="ed-cuatri-tit">Cómo va la carga</div>
          <div className="ed-resumen-corr">
            {materias
              .filter((m) => m.cod.trim() && !m.opt)
              .map((m) => {
                const n = previasDe(b, m.cod).length
                const primerCuatri = m.anio === (anios[0] ?? 1) && m.cuatri === 1
                return (
                  <button
                    key={m.orden}
                    className={`ed-rc ${n ? 'con' : primerCuatri ? 'na' : 'sin'}`}
                    title={
                      n
                        ? `Necesita: ${previasDe(b, m.cod)
                            .map((c) => b.materias.find((x) => x.cod === c)?.nom ?? c)
                            .join(', ')}`
                        : primerCuatri
                          ? 'Es del primer cuatrimestre: no puede tener previas'
                          : 'Todavía no tiene correlativas cargadas'
                    }
                    onClick={() => {
                      setObjetivo(m.cod)
                      setArbol(true)
                    }}
                  >
                    <span className="adm-meta">
                      {m.anio}°·{m.cuatri}C
                    </span>
                    <span className="ed-corr-nom">{m.nom || m.cod}</span>
                    <span className="ed-rc-n">{n ? `${n} previa${n > 1 ? 's' : ''}` : primerCuatri ? '—' : 'sin cargar'}</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* ── TÍTULOS ── */}
      {pestania === 'titulos' && (
        <div className="ed-cuerpo">
          <p className="adm-meta">
            Un título se otorga al aprobar todo hasta el año indicado (o hasta un
            cuatrimestre, si el hito cae a mitad de año).
          </p>
          {b.titulos.map((t, i) => (
            <div className="ed-fila" key={i}>
              <input
                className="ed-nom"
                value={t.nombre}
                placeholder="nombre del título"
                disabled={!puedeEditar}
                aria-label="Nombre del título"
                onChange={(e) => {
                  const titulos = b.titulos.map((x, j) =>
                    j === i ? { ...x, nombre: e.target.value } : x,
                  )
                  cambiar({ ...b, titulos })
                }}
                onBlur={() => void correr(() => guardarTitulos(planId, b.titulos))}
              />
              <select
                className="ed-mover ed-hasta"
                value={`${t.hastaAnio}-${t.hastaCuatri ?? 0}`}
                disabled={!puedeEditar}
                aria-label="Hasta qué año y cuatrimestre"
                onChange={(e) => {
                  const [a, c] = e.target.value.split('-').map(Number)
                  const titulos: TituloPlan[] = b.titulos.map((x, j) =>
                    j === i
                      ? { nombre: x.nombre, hastaAnio: a, ...(c ? { hastaCuatri: c } : {}) }
                      : x,
                  )
                  cambiar({ ...b, titulos })
                  void correr(() => guardarTitulos(planId, titulos))
                }}
              >
                {(anios.length ? anios : [1]).flatMap((a) => [
                  <option key={`${a}-0`} value={`${a}-0`}>
                    hasta {a}° año completo
                  </option>,
                  <option key={`${a}-1`} value={`${a}-1`}>
                    hasta {a}° · 1°C
                  </option>,
                  <option key={`${a}-2`} value={`${a}-2`}>
                    hasta {a}° · 2°C
                  </option>,
                ])}
              </select>
              <button
                className="ed-borrar"
                disabled={!puedeEditar}
                onClick={() => {
                  const titulos = b.titulos.filter((_, j) => j !== i)
                  cambiar({ ...b, titulos })
                  void correr(() => guardarTitulos(planId, titulos))
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {puedeEditar && (
            <button
              className="ed-add"
              onClick={() =>
                cambiar({
                  ...b,
                  titulos: [...b.titulos, { nombre: '', hastaAnio: anios.at(-1) ?? 1 }],
                })
              }
            >
              + título
            </button>
          )}
        </div>
      )}

      {/* ── REVISAR Y PUBLICAR ── */}
      <section className="ed-publicar">
        <h3>Revisar y publicar</h3>
        {errores.length === 0 ? (
          <p className="ed-verde">✓ El plan no tiene errores: se puede publicar.</p>
        ) : (
          <>
            <p className="ed-rojo">
              {errores.length} {errores.length === 1 ? 'error' : 'errores'} — hay que
              corregirlos antes de publicar:
            </p>
            <ul className="ed-hallazgos">
              {errores.slice(0, 12).map((h, i) => (
                <li key={i} className="err">
                  {h.mensaje}
                </li>
              ))}
            </ul>
          </>
        )}
        {avisos.length > 0 && (
          <ul className="ed-hallazgos">
            {avisos.map((h, i) => (
              <li key={i} className="avi">
                {h.mensaje}
              </li>
            ))}
          </ul>
        )}

        {puedeEditar && (
          <div className="ed-pub-fila">
            <input
              className="ed-nom"
              value={nota}
              placeholder="Qué cambió (opcional, queda en el historial)"
              aria-label="Nota de la versión"
              onChange={(e) => setNota(e.target.value)}
            />
            <button
              className="btn"
              disabled={errores.length > 0 || publicando}
              onClick={() => {
                if (!confirm('¿Publicar? Los alumnos van a ver esta versión.')) return
                setPublicando(true)
                void (async () => {
                  try {
                    const v = await publicarPlan(planId, nota.trim() || null)
                    setNota('')
                    setVersiones(await cargarVersiones(planId))
                    setError(null)
                    alert(`Publicado como versión ${v}.`)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e))
                  } finally {
                    setPublicando(false)
                  }
                })()
              }}
            >
              {publicando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        )}

        {versiones.length > 0 && (
          <div className="ed-versiones">
            <div className="ed-cuatri-tit">Historial</div>
            {versiones.map((v) => (
              <div className="ed-ver" key={v.version}>
                <span className="adm-meta">v{v.version}</span>
                <span className="ed-ver-fecha adm-meta">
                  {new Date(v.publicado_at).toLocaleDateString('es-AR')}
                </span>
                <span className="ed-ver-nota">{v.nota ?? '—'}</span>
                {puedeEditar && v.version !== versiones[0].version && (
                  <button
                    className="lnk"
                    onClick={() => {
                      if (!confirm(`¿Volver a la versión ${v.version}? Tu borrador no se toca.`)) {
                        return
                      }
                      void correr(async () => {
                        await revertirPlan(planId, v.version)
                        setVersiones(await cargarVersiones(planId))
                      })
                    }}
                  >
                    Volver a esta
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── EL ÁRBOL COMO EDITOR ── */}
      {arbol && (
        <>
          <div className="ed-arbol-bar">
            {!objetivo ? (
              <span className="ed-ab-guia">
                <strong>Tocá una materia</strong> del árbol para empezar
              </span>
            ) : (
              <>
                <span className="ed-ab-obj">
                  {b.materias.find((m) => m.cod === objetivo)?.nom || objetivo}
                </span>
                <span className="ed-ab-dir">
                  <button
                    className={direccion === 'anterior' ? 'on' : ''}
                    onClick={() => setDireccion('anterior')}
                  >
                    necesita…
                  </button>
                  <button
                    className={direccion === 'posterior' ? 'on' : ''}
                    onClick={() => setDireccion('posterior')}
                  >
                    habilita…
                  </button>
                </span>
                <span className="ed-ab-guia">
                  {elegiblesAhora.size === 0
                    ? direccion === 'anterior'
                      ? 'No hay materias en cuatrimestres anteriores.'
                      : 'No hay materias en cuatrimestres posteriores.'
                    : `Tocá las ${elegiblesAhora.size} materias iluminadas para conectar o desconectar`}
                </span>
                <button className="lnk" onClick={() => setObjetivo(null)}>
                  otra materia
                </button>
              </>
            )}
            <button className="ed-ab-listo" onClick={() => setArbol(false)}>
              Listo
            </button>
          </div>
          <Suspense fallback={<div className="tv-cargando" />}>
            <TreeView
              focus={objetivo}
              onClose={() => setArbol(false)}
              planExterno={planDelBorrador ?? undefined}
              edicion={{
                objetivo: objetivo ?? '',
                direccion,
                elegibles: elegiblesAhora,
                yaConectadas: conectadasAhora,
                onAlternar: (cod) => {
                  if (!objetivo) {
                    setObjetivo(cod)
                    return
                  }
                  if (!puedeEditar) return
                  // la arista es la misma en las dos direcciones: cambia quién es el dueño
                  const [dueno, previa] =
                    direccion === 'anterior' ? [objetivo, cod] : [cod, objetivo]
                  const nuevo = alternarPrevia(b, dueno, previa)
                  cambiar(nuevo)
                  void correr(() => guardarPrevias(planId, dueno, previasDe(nuevo, dueno)))
                },
              }}
            />
          </Suspense>
        </>
      )}
    </div>
  )
}
