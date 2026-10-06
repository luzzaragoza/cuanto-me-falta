// Permisos y cupos: lo único que el superadmin puede hacer y nadie más (diseño de Luz,
// 28-sep).
//
// "¿Quién entra a cada institución y con cuánto cupo?" — y dar de alta una nueva. Antes
// eran dos pantallas (la lista de universidades y, al entrar a una, sus habilitados y su
// límite en un campo numérico). Ahora cada institución es UNA tarjeta con todo a la
// vista: sus admins a la izquierda, su cupo a la derecha con un botón para subirlo y
// otro para bajarlo. Son unidades, no miles: no hace falta entrar a mirar de a una.
//
// SIN MATICES (decisión de Luz, 12-ago): habilitar a alguien en una institución es darle
// todo ahí adentro —crear, editar, publicar, eliminar— hasta el cupo. Lo que se reparte
// es el CUPO, porque es la cláusula del contrato. Ver `supabase/010`.
//
// Se habilita POR MAIL y no por id porque el superadmin conoce a la persona por su mail.
// Las tres operaciones pasan por funciones `security definer` (migración 008): el mail
// vive en `auth.users`, que PostgREST no expone.

import { useEffect, useState } from 'react'
import { repo, type AdminHabilitado, type UniversidadAdmin } from '../state/admin'
import {
  Cupo,
  dominioComun,
  fechaCorta,
  siglaDe,
  UniversidadNueva,
  type PlanAdmin,
} from '../lib/admin'
import { useConfirmar } from '../components/Confirmar'

/** Con qué cupo nace una institución. Se ajusta después con el "+". */
const CUPO_INICIAL = 3

export function PanelSuper({
  universidades,
  planes,
  onCambio,
}: {
  universidades: UniversidadAdmin[]
  planes: PlanAdmin[]
  /** Algo cambió en la base (una institución nueva, un cupo): recargar. */
  onCambio: () => void
}) {
  /** Los admins de cada institución. `undefined` = todavía no llegaron. */
  const [admins, setAdmins] = useState<Record<string, AdminHabilitado[]>>({})
  const [alta, setAlta] = useState(false)

  const recargarAdmins = (uni: string): void => {
    void repo
      .cargarAdmins(uni)
      .then((a) => setAdmins((prev) => ({ ...prev, [uni]: a })))
      .catch(() => {
        /* la tarjeta muestra su propio error al operar; acá no vale romper la pantalla */
      })
  }

  // Una RPC por institución. Solo la corre el superadmin, y son unidades.
  useEffect(() => {
    for (const u of universidades) recargarAdmins(u.id)
  }, [universidades])

  const planesDe = (uni: string): number => planes.filter((p) => p.universidad_id === uni).length
  const nAdmins = Object.values(admins).reduce((n, a) => n + a.length, 0)
  const nPlanes = universidades.reduce((n, u) => n + planesDe(u.id), 0)
  const nCupo = universidades.reduce((n, u) => n + u.limite_planes, 0)

  return (
    <main className="adm-scroll">
      <section className="lp-hero pc-hero">
        <span className="lp-deco d1" />
        <span className="lp-deco d2" />
        <span className="lp-deco d3" />
        <div className="lp-hero-in">
          <div className="pc-kicker">solo superadmin</div>
          <h1 className="lp-titulo pc-titulo">Permisos y cupos</h1>
          <p className="lp-frase">
            Un admin carga, edita y publica planes solo en su institución, hasta el cupo que le
            des.
          </p>
          <div className="pc-resumen">
            <div className="pc-dato">
              <span className="n tono-2">{universidades.length}</span>
              <span className="l">{universidades.length === 1 ? 'institución' : 'instituciones'}</span>
            </div>
            <div className="pc-dato">
              <span className="n tono-0">{nAdmins}</span>
              <span className="l">{nAdmins === 1 ? 'admin' : 'admins'}</span>
            </div>
            <div className="pc-dato">
              <span className="n tono-1">
                {nPlanes}/{nCupo}
              </span>
              <span className="l">planes del cupo total</span>
            </div>
            <button className="lp-primario grande pc-alta-btn" onClick={() => setAlta(true)}>
              + Dar de alta una institución
            </button>
          </div>
        </div>
      </section>

      <div className="lp-cuerpo pc-cuerpo">
        {alta && (
          <AltaInstitucion
            existentes={universidades.map((u) => u.id)}
            onCerrar={() => setAlta(false)}
            onCreada={() => {
              setAlta(false)
              onCambio()
            }}
          />
        )}

        <div className="pc-lista">
          {universidades.map((u, k) => (
            <TarjetaInstitucion
              key={u.id}
              uni={u}
              tono={k % 3}
              planes={planesDe(u.id)}
              admins={admins[u.id]}
              onAdmins={() => recargarAdmins(u.id)}
              onCambio={onCambio}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

/**
 * El alta: nombre y sigla. La SIGLA es el id de la institución en la base (en
 * minúscula), y es permanente —es el prefijo del id de cada uno de sus planes—, así que
 * se pide explícita en vez de adivinarla del nombre.
 */
function AltaInstitucion({
  existentes,
  onCerrar,
  onCreada,
}: {
  existentes: string[]
  onCerrar: () => void
  onCreada: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [sigla, setSigla] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nueva = new UniversidadNueva(nombre, CUPO_INICIAL, sigla.toLowerCase())
  const completa = nombre.trim() !== '' && sigla.trim() !== ''
  const problemas = completa ? nueva.problemas(existentes) : []

  const crear = async (): Promise<void> => {
    if (!completa || problemas.length > 0) return
    setCreando(true)
    setError(null)
    try {
      await repo.crearUniversidad({
        id: nueva.id,
        nombre: nombre.trim(),
        limite_planes: CUPO_INICIAL,
      })
      onCreada()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCreando(false)
    }
  }

  return (
    <div className="pc-alta">
      <span className="pc-alta-deco" />
      <div className="pc-alta-head">
        <span className="pc-alta-sigla">{sigla.trim() || '?'}</span>
        <h2>Institución nueva</h2>
      </div>
      <div className="pc-alta-campos">
        <label className="pc-campo ancho">
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Universidad de Buenos Aires"
            autoFocus
          />
        </label>
        <label className="pc-campo sigla">
          Sigla
          <input
            value={sigla}
            onChange={(e) => setSigla(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 6))}
            placeholder="UBA"
          />
        </label>
        <button
          className="pc-crear"
          onClick={() => void crear()}
          disabled={!completa || problemas.length > 0 || creando}
        >
          {creando ? 'Creando…' : `Crear con cupo de ${CUPO_INICIAL}`}
        </button>
        <button className="pc-cancelar" onClick={onCerrar}>
          Cancelar
        </button>
      </div>
      {(problemas.length > 0 || error) && (
        <p className="pc-alta-error">{error ?? problemas.join(' ')}</p>
      )}
    </div>
  )
}

/** Una institución: sus admins y su cupo, en una sola tarjeta. */
function TarjetaInstitucion({
  uni,
  tono,
  planes,
  admins,
  onAdmins,
  onCambio,
}: {
  uni: UniversidadAdmin
  /** 0 naranja · 1 oliva · 2 neutro, en el orden en que aparecen. */
  tono: number
  planes: number
  admins: AdminHabilitado[] | undefined
  onAdmins: () => void
  onCambio: () => void
}) {
  const [mail, setMail] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El cupo se ve cambiar al toque; la base lo confirma atrás. Si falla, vuelve.
  const [cupo, setCupo] = useState(uni.limite_planes)
  useEffect(() => setCupo(uni.limite_planes), [uni.limite_planes])
  const { pedir, dialogo } = useConfirmar()

  const lista = admins ?? []
  const dominio = dominioComun(lista.map((a) => a.email))
  const piso = Cupo.piso(planes)
  const libres = Math.max(0, cupo - planes)

  const agregar = async (): Promise<void> => {
    if (!mail.includes('@')) return
    setAgregando(true)
    setError(null)
    try {
      await repo.habilitarAdmin({ email: mail, uni: uni.id })
      setMail('')
      onAdmins()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAgregando(false)
    }
  }

  const quitar = (a: AdminHabilitado): void => {
    pedir({
      titulo: '¿Sacarle los permisos?',
      texto: `${a.email} deja de poder tocar los planes de ${uni.nombre}. Tiene efecto inmediato: los permisos se chequean en la base en cada operación, no quedan cacheados en su sesión.`,
      confirmar: 'Sacar los permisos',
      peligro: true,
      onSi: () => {
        setError(null)
        void repo
          .revocarAdmin(a.email, uni.id)
          .then(onAdmins)
          .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      },
    })
  }

  const ajustar = (n: number): void => {
    if (n < piso) return
    const antes = cupo
    setCupo(n)
    setError(null)
    void repo
      .guardarLimite(uni.id, n)
      .then(onCambio)
      .catch((e: unknown) => {
        setCupo(antes)
        setError(e instanceof Error ? e.message : String(e))
      })
  }

  return (
    <section className={`pc-inst tono-${tono}`}>
      {dialogo}
      <div className="pc-inst-izq">
        <div className="pc-inst-head">
          <span className="pc-inst-sigla">{siglaDe(uni)}</span>
          <div className="pc-inst-id">
            <h2>{uni.nombre}</h2>
            <div className="pc-inst-sub">
              <span className="pc-caras">
                {lista.map((a, i) => (
                  <span key={a.user_id} className={`pc-cara cara-${i % 3}`}>
                    {a.email.charAt(0).toUpperCase()}
                  </span>
                ))}
              </span>
              <span className="pc-inst-cuantos">
                {admins === undefined
                  ? ''
                  : lista.length === 0
                    ? 'sin admins'
                    : lista.length === 1
                      ? '1 admin'
                      : `${lista.length} admins`}
              </span>
            </div>
          </div>
        </div>

        <div className="pc-admins">
          {lista.map((a, i) => (
            <div className="pc-admin" key={a.user_id}>
              <span className={`pc-admin-ini cara-${i % 3}`}>{a.email.charAt(0).toUpperCase()}</span>
              <span className="pc-admin-quien">
                <span className="pc-admin-mail">{a.email}</span>
                <span className="pc-admin-desde">admin desde el {fechaCorta(a.otorgado_at)}</span>
              </span>
              <button className="pc-quitar" onClick={() => quitar(a)}>
                Quitar
              </button>
            </div>
          ))}
          {admins !== undefined && lista.length === 0 && (
            <p className="pc-sin-admins">Todavía no tiene admins: nadie puede cargar sus planes.</p>
          )}
          <form
            className="pc-agregar"
            onSubmit={(e) => {
              e.preventDefault()
              void agregar()
            }}
          >
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              placeholder={dominio ? `mail@${dominio}` : 'mail de quien va a cargar los planes'}
              aria-label={`Mail de quien va a administrar ${uni.nombre}`}
            />
            <button type="submit" disabled={!mail.includes('@') || agregando}>
              {agregando ? 'Agregando…' : '+ Agregar admin'}
            </button>
          </form>
          {error && <p className="pc-error">{error}</p>}
        </div>
      </div>

      <div className="pc-cupo">
        <span className="pc-cupo-deco" />
        <div className="pc-cupo-lbl">cupo de planes</div>
        <div className="pc-cupo-num">
          <span className="n">{planes}</span>
          <span className="de">de {cupo}</span>
        </div>
        <div className="pc-slots" aria-hidden="true">
          {Array.from({ length: cupo }, (_, i) => (
            <span key={i} className={i < planes ? 'lleno' : ''} />
          ))}
        </div>
        <div className="pc-libres">
          {libres === 0
            ? 'Sin lugar para planes nuevos.'
            : libres === 1
              ? 'Puede cargar 1 plan más.'
              : `Puede cargar ${libres} planes más.`}
        </div>
        <div className="pc-ajustar">
          <button
            onClick={() => ajustar(cupo - 1)}
            disabled={cupo <= piso}
            title={cupo <= piso ? 'No puede bajar de los planes que ya tiene cargados' : 'Bajar cupo'}
            aria-label="Bajar cupo"
          >
            −
          </button>
          <button onClick={() => ajustar(cupo + 1)} title="Subir cupo" aria-label="Subir cupo">
            +
          </button>
          <span>ajustar cupo</span>
        </div>
      </div>
    </section>
  )
}
