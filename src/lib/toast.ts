import { useSyncExternalStore } from 'react'

export type ToastTone = 'warn' | 'info'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  msg: string
  tone: ToastTone
  action?: ToastAction
}

type Listener = () => void

/**
 * Bus de avisos flotantes (toasts): observable + auto-descarte.
 * Cualquier módulo llama `toast.show(...)`; el <Toaster/> se suscribe y los pinta.
 */
class ToastBus {
  private items: Toast[] = []
  private listeners = new Set<Listener>()
  private seq = 0

  show(msg: string, tone: ToastTone = 'info', action?: ToastAction, ms?: number): number {
    const id = ++this.seq
    this.items = [...this.items, { id, msg, tone, action }]
    this.emit()
    // los avisos con acción viven un poco más para poder tocarlos
    window.setTimeout(() => this.dismiss(id), ms ?? (action ? 6000 : 4200))
    return id
  }

  dismiss(id: number): void {
    const next = this.items.filter((t) => t.id !== id)
    if (next.length === this.items.length) return
    this.items = next
    this.emit()
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getSnapshot = (): Toast[] => this.items

  private emit(): void {
    for (const l of this.listeners) l()
  }
}

export const toast = new ToastBus()

export function useToasts(): Toast[] {
  return useSyncExternalStore(toast.subscribe, toast.getSnapshot)
}
