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
import { salir } from './auth'
import { store } from './store'
import {
  decidirMerge,
  escribirLocal,
  guardarBase,
  guardarConsent,
  huellaProgreso,
  leerBase,
  leerConsent,
  leerDirty,
  limpiarDirty,
  marcarDirty,
  merge3,
  snapshotLocal,
  totalMarcadas,
  type RemoteData,
} from '../lib/sync'

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

export function getConflicto(): Conflicto | null {
  return conflicto
}

// ---- push (subir lo local) ----

const DEBOUNCE_MS = 1500

async function push(): Promise<void> {
  if (!supabase || !userId) return
  setEstado('guardando')
  const data = snapshotLocal()
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
    if (!timer) limpiarDirty()
    guardarBase(userId, data) // esto es lo que la nube tiene ahora
    setEstado('listo')
  }
}

function programarPush(): void {
  // sin sesión, sin consentimiento aceptado, o con conflicto sin resolver: no se sube nada
  if (!userId || estado === 'conflicto' || estado === 'consentimiento') return
  // 'off' = el merge inicial todavía no corrió (o se rechazó el consentimiento):
  // no es un cambio "por encima de la cuenta", no marca nada
  if (estado !== 'off') marcarDirty(userId)
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
  const flag = leerDirty()
  if (flag && flag !== uid) limpiarDirty()

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

  const remoto = (data?.data as RemoteData | undefined) ?? null

  // Gate de consentimiento (Ley 25.326): antes de guardar nada en el servidor,
  // el usuario tiene que aceptar los TyC/Privacidad UNA vez por cuenta. El registro
  // viaja con los datos: si ya aceptó en otro dispositivo, no se le vuelve a pedir.
  if (!remoto?.consentimiento && !leerConsent()) {
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

function continuarMerge(remoto: RemoteData | null): void {
  if (!userId) return
  const local = snapshotLocal()
  // quedaron cambios de ESTE usuario sin subir (editó/borró y refrescó antes del
  // push con debounce): lo local es más nuevo, no se baja nada arriba de eso
  const dirty = leerDirty() === userId
  // la última sincronización de esta cuenta EN ESTE dispositivo: la huella decide
  // quién se movió (bajar/subir solo, sin preguntar) y la data completa habilita
  // la fusión cuando se movieron los dos
  const base = leerBase(userId)

  switch (decidirMerge(remoto, local, dirty, base?.huella ?? null)) {
    case 'push':
      // la marca sobrevive a un push fallido + refresh: lo local sigue mandando
      marcarDirty(userId)
      void push()
      break
    case 'pull':
      limpiarDirty() // lo local queda reconciliado con la cuenta
      guardarBase(userId, remoto!)
      escribirLocal(remoto!)
      marcarTourVisto()
      location.reload() // el singleton del Store se reconstruye con lo bajado
      break
    case 'nada':
      guardarBase(userId, local)
      // si la fila remota todavía no tiene el consentimiento (cuentas creadas
      // antes de este build), lo subimos ya — si no, otro dispositivo lo re-pediría
      if (!remoto?.consentimiento && leerConsent()) void push()
      else setEstado('listo')
      break
    case 'conflicto': {
      // ¿Avanzaron los dos pero en materias DISTINTAS? Con la base completa se
      // fusiona sin perder nada de ningún lado — el modal queda solo para el
      // choque real (misma materia con valores distintos) o sin base (1ª vez).
      const fusion = base?.data ? merge3(base.data, local, remoto!) : null
      if (fusion) {
        marcarDirty(userId) // la fusión manda hasta que el push aterrice
        if (huellaProgreso(fusion) === huellaProgreso(local)) {
          void push() // lo local ya ES la fusión: solo falta subirla
        } else {
          escribirLocal(fusion)
          marcarTourVisto()
          location.reload() // remonta con la fusión; el próximo merge la sube
        }
        break
      }
      conflicto = {
        remoto: remoto!,
        marcadasLocal: totalMarcadas(local),
        marcadasCuenta: totalMarcadas(remoto),
      }
      setEstado('conflicto')
      break
    }
  }
}

/** El usuario aceptó los TyC/Privacidad: se registra y sigue el merge normal. */
export function aceptarConsentimiento(): void {
  guardarConsent()
  const remoto = remotoPendiente
  remotoPendiente = null
  continuarMerge(remoto)
}

/** No aceptó: se cierra la sesión y la app sigue 100% local (nada se subió). */
export function rechazarConsentimiento(): void {
  remotoPendiente = null
  setEstado('off')
  void salir()
}

/** El usuario eligió en el modal de conflicto: quedarse con la nube o con lo local. */
export function resolverConflicto(eleccion: 'nube' | 'local'): void {
  if (!conflicto || !userId) return
  const remoto = conflicto.remoto
  conflicto = null
  if (eleccion === 'nube') {
    limpiarDirty() // eligió la nube: los cambios locales pendientes se descartan
    guardarBase(userId, remoto)
    escribirLocal(remoto)
    marcarTourVisto()
    location.reload()
  } else {
    // decisión explícita del usuario: lo local pisa la nube (la marca sobrevive
    // a un push fallido + refresh, para que la elección no se pierda)
    marcarDirty(userId)
    void push()
  }
}

// ---- init (llamar una vez, en main.tsx) ----

export function initSync(): void {
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
