// Orquestador del sync: escucha la sesión (auth) y el Store, y mantiene la fila
// `progreso` de Supabase al día. Estado observable para la UI (guardando/error/
// conflicto) con el mismo patrón useSyncExternalStore del resto de la app.
//
// Reglas:
// - Al entrar: se trae lo remoto y se decide (lib/sync.decidirMerge) usando la
//   BASE de la última sincronización: si solo la nube avanzó → baja solo; si solo
//   lo local avanzó → sube solo. El modal de conflicto queda para la primera vez
//   de la cuenta en este dispositivo (con avance previo) o si avanzaron los dos.
// - Cada cambio local (Store.commit → notify) programa un push con debounce, y
//   deja la marca `cmf-sync-dirty` (por user id) hasta que el push aterriza. Si
//   el usuario refresca en esa ventana, el merge sabe que lo local es más nuevo
//   y NO lo pisa con un pull (ej.: "Reiniciar todo" + F5 queda borrado).
// - Cada push que aterriza (y cada pull) actualiza la base — el estado que la
//   nube y este dispositivo tienen en común.
// - Sin backend o sin sesión: todo es no-op y la app queda 100% local.

import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { Auth } from './auth'
import { store } from './store'
import { Base, Consentimiento, MarcaSinSubir, RemoteData } from '../lib/sync'

export type SyncEstado =
  | 'off'
  | 'consentimiento'
  | 'listo'
  | 'guardando'
  | 'error'
  | 'conflicto'

export interface Conflicto {
  remoto: RemoteData
  marcadasLocal: number
  marcadasCuenta: number
}

let estado: SyncEstado = 'off'
let conflicto: Conflicto | null = null
let userId: string | null = null
let mergeHechoPara: string | null = null // evita re-merge en TOKEN_REFRESHED etc.
let timer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const setEstado = (e: SyncEstado) => {
  estado = e
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Hook: estado del sync para la UI (indicador + modal de conflicto). */
export function useSyncEstado(): SyncEstado {
  return useSyncExternalStore(subscribe, () => estado, () => 'off' as const)
}

function conflictoActual(): Conflicto | null {
  return conflicto
}

// ---- push (subir lo local) ----

const DEBOUNCE_MS = 1500

async function push(): Promise<void> {
  if (!supabase || !userId) return
  setEstado('guardando')
  const data = RemoteData.local()
  const { error } = await supabase.from('progreso').upsert({
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.warn('[sync] push falló:', error.message)
    setEstado('error')
  } else {
    // llegó al server: ya no hay cambios pendientes… salvo que hayan editado
    // DURANTE el vuelo (quedó otro push programado) — ahí la marca sigue viva
    if (!timer) MarcaSinSubir.limpiar()
    Base.guardar(userId, data) // esto es lo que la nube tiene ahora
    setEstado('listo')
  }
}

function programarPush(): void {
  // sin sesión, sin consentimiento aceptado, o con conflicto sin resolver: no se sube nada
  if (!userId || estado === 'conflicto' || estado === 'consentimiento') return
  // 'off' = el merge inicial todavía no corrió (o se rechazó el consentimiento):
  // no es un cambio "por encima de la cuenta", no marca nada
  if (estado !== 'off') MarcaSinSubir.poner(userId)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void push()
  }, DEBOUNCE_MS)
}

// ---- merge inicial al entrar ----

async function alEntrar(uid: string): Promise<void> {
  if (!supabase) return
  // una marca de cambios pendientes de OTRA cuenta no vale acá (navegador compartido)
  const flag = MarcaSinSubir.de()
  if (flag && flag !== uid) MarcaSinSubir.limpiar()

  const { data, error } = await supabase
    .from('progreso')
    .select('data')
    .eq('user_id', uid)
    .maybeSingle()

  if (error) {
    console.warn('[sync] no pude leer lo remoto:', error.message)
    setEstado('error')
    return
  }

  // dato de red: entra por la factory, nunca por un cast (ver `state/store.ts`)
  const remoto = RemoteData.desde(data?.data)

  // Gate de consentimiento (Ley 25.326): antes de guardar nada en el servidor,
  // el usuario tiene que aceptar los TyC/Privacidad UNA vez por cuenta. El registro
  // viaja con los datos: si ya aceptó en otro dispositivo, no se le vuelve a pedir.
  if (!remoto?.consentimiento && !Consentimiento.leer()) {
    remotoPendiente = remoto
    setEstado('consentimiento')
    return
  }

  continuarMerge(remoto)
}

let remotoPendiente: RemoteData | null = null

// Quien baja su avance de la cuenta ya usó la app: no corresponde re-mostrarle
// el tutorial en este dispositivo (se pisaba con los modales del sync, además).
function marcarTourVisto(): void {
  try {
    localStorage.setItem('cmf-tour-visto', '1')
  } catch {
    /* noop */
  }
}

// Retención POR CUENTA de una app "para entrar a mirar": marca cuándo abrió por
// última vez, SIN tocar `data`/`updated_at` (no interfiere con el last-write-wins).
// `update`, no `upsert`: si no hay fila (nunca marcó nada) es no-op — no hay nada que
// "volver a mirar". Best-effort: si la columna todavía no existe o falla la red, no
// rompe (retención = `visto_at::date > created_at::date` en el SQL editor).
async function marcarVisto(uid: string): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase
      .from('progreso')
      .update({ visto_at: new Date().toISOString() })
      .eq('user_id', uid)
    if (error) console.warn('[sync] visto_at:', error.message)
  } catch {
    /* noop */
  }
}

function continuarMerge(remoto: RemoteData | null): void {
  if (!userId) return
  void marcarVisto(userId) // registra la vuelta-a-mirar (no bloquea el merge)
  const local = RemoteData.local()
  // quedaron cambios de ESTE usuario sin subir (editó/borró y refrescó antes del
  // push con debounce): lo local es más nuevo, no se baja nada arriba de eso
  const dirty = MarcaSinSubir.esDe(userId)
  // la última sincronización de esta cuenta EN ESTE dispositivo: la huella decide
  // quién se movió (bajar/subir solo, sin preguntar) y la data completa habilita
  // la fusión cuando se movieron los dos
  const base = Base.leer(userId)

  switch (RemoteData.decidir(remoto, local, dirty, base?.huella ?? null)) {
    case 'push':
      // la marca sobrevive a un push fallido + refresh: lo local sigue mandando
      MarcaSinSubir.poner(userId)
      void push()
      break
    case 'pull':
      MarcaSinSubir.limpiar() // lo local queda reconciliado con la cuenta
      Base.guardar(userId, remoto!)
      remoto!.escribirLocal()
      marcarTourVisto()
      location.reload() // el singleton del Store se reconstruye con lo bajado
      break
    case 'nada':
      Base.guardar(userId, local)
      // si la fila remota todavía no tiene el consentimiento (cuentas creadas
      // antes de este build), lo subimos ya — si no, otro dispositivo lo re-pediría
      if (!remoto?.consentimiento && Consentimiento.leer()) void push()
      else setEstado('listo')
      break
    case 'conflicto': {
      // ¿Avanzaron los dos pero en materias DISTINTAS? Con la base completa se
      // fusiona sin perder nada de ningún lado — el modal queda solo para el
      // choque real (misma materia con valores distintos) o sin base (1ª vez).
      const fusion = base?.data ? base.data.fusionar(local, remoto!) : null
      if (fusion) {
        MarcaSinSubir.poner(userId) // la fusión manda hasta que el push aterrice
        if (fusion.huella === local.huella) {
          void push() // lo local ya ES la fusión: solo falta subirla
        } else {
          fusion.escribirLocal()
          marcarTourVisto()
          location.reload() // remonta con la fusión; el próximo merge la sube
        }
        break
      }
      conflicto = {
        remoto: remoto!,
        marcadasLocal: local.totalMarcadas,
        marcadasCuenta: remoto?.totalMarcadas ?? 0,
      }
      setEstado('conflicto')
      break
    }
  }
}

/** El usuario aceptó los TyC/Privacidad: se registra y sigue el merge normal. */
function aceptar(): void {
  Consentimiento.aceptar()
  const remoto = remotoPendiente
  remotoPendiente = null
  continuarMerge(remoto)
}

/** No aceptó: se cierra la sesión y la app sigue 100% local (nada se subió). */
function rechazar(): void {
  remotoPendiente = null
  setEstado('off')
  void Auth.salir()
}

/** El usuario eligió en el modal de conflicto: quedarse con la nube o con lo local. */
function resolver(eleccion: 'nube' | 'local'): void {
  if (!conflicto || !userId) return
  const remoto = conflicto.remoto
  conflicto = null
  if (eleccion === 'nube') {
    MarcaSinSubir.limpiar() // eligió la nube: los cambios locales pendientes se descartan
    Base.guardar(userId, remoto)
    remoto.escribirLocal()
    marcarTourVisto()
    location.reload()
  } else {
    // decisión explícita del usuario: lo local pisa la nube (la marca sobrevive
    // a un push fallido + refresh, para que la elección no se pierda)
    MarcaSinSubir.poner(userId)
    void push()
  }
}

// ---- init (llamar una vez, en main.tsx) ----

function iniciarSync(): void {
  if (!supabase) return

  supabase.auth.onAuthStateChange((_evento, session) => {
    const uid = session?.user.id ?? null
    userId = uid
    if (!uid) {
      mergeHechoPara = null
      conflicto = null
      setEstado('off')
      return
    }
    if (mergeHechoPara !== uid) {
      mergeHechoPara = uid
      void alEntrar(uid)
    }
  })

  // cada cambio del usuario (estado/nota/optativa/perfil) programa un push
  store.subscribe(programarPush)

  // El push va con debounce, pero en el celu nadie espera 1.5s: marcás algo y
  // cambiás de app (o bloqueás la pantalla) y el timer congelado nunca dispara →
  // ese cambio viajaba recién "la próxima vez" y generaba divergencias. Al perder
  // el foco, lo pendiente se sube YA. (pagehide cubre además el cierre de pestaña.)
  const flush = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = null
    void push()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

/**
 * La sincronización del avance con la cuenta: cuándo se sube, cuándo se baja y qué se
 * le pregunta al usuario.
 *
 * `useSyncEstado` queda como función porque es un hook de React (ver `Auth`).
 */
export class Sync {
  /** Arranca el orquestador: merge una vez por sesión + push con debounce. */
  static iniciar(): void {
    iniciarSync()
  }

  /** El conflicto pendiente de resolver, o `null`. */
  static conflicto(): Conflicto | null {
    return conflictoActual()
  }

  /** El usuario aceptó los términos: recién ahí se sube el primer byte. */
  static aceptarConsentimiento(): void {
    aceptar()
  }

  static rechazarConsentimiento(): void {
    rechazar()
  }

  /** Resuelve el conflicto con lo que eligió el usuario. */
  static resolverConflicto(eleccion: 'nube' | 'local'): void {
    resolver(eleccion)
  }
}
