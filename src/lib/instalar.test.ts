import { describe, it, expect, beforeEach } from 'vitest'
import { Instalar } from './instalar'

// localStorage de mentira, igual que en `domain/Store.test.ts`: `Instalar` lo lee del
// scope global. Lo que se prueba acá es SOLO la memoria de la oferta — lo otro que
// hace el módulo (`beforeinstallprompt`, `matchMedia`) es del navegador y no existe
// en node; su comportamiento se verifica manejando la app.
function fakeLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

beforeEach(() => {
  globalThis.localStorage = fakeLocalStorage()
})

describe('Instalar · a quién se le vuelve a ofrecer', () => {
  it('de entrada no hay nada rechazado', () => {
    expect(Instalar.rechazado()).toBe(false)
  })

  it('"No mostrar más" es definitivo', () => {
    Instalar.noOfrecerMas()
    expect(Instalar.rechazado()).toBe(true)
  })

  // La razón de ser del rediseño: cerrar la hoja sin decir que no NO la gasta.
  it('"Ahora no" no escribe nada: la próxima apertura vuelve a ofrecer', () => {
    expect(localStorage.length).toBe(0)
    expect(Instalar.rechazado()).toBe(false)
  })

  it('sobrevive a recargar (vive en el storage, no en memoria)', () => {
    Instalar.noOfrecerMas()
    const guardado = localStorage.getItem('cmf-instalar')
    globalThis.localStorage = fakeLocalStorage()
    localStorage.setItem('cmf-instalar', guardado!)
    expect(Instalar.rechazado()).toBe(true)
  })

  // Quien descartó la franja de iOS que esto reemplazó ya dijo que no a lo mismo.
  it('respeta el descarte de la franja vieja de iOS', () => {
    localStorage.setItem('cmf-aviso-ios', '1')
    expect(Instalar.rechazado()).toBe(true)
  })

  it('no escribe en la clave vieja: se muere sola', () => {
    Instalar.noOfrecerMas()
    expect(localStorage.getItem('cmf-aviso-ios')).toBeNull()
  })

  it('con el storage bloqueado no se ofrece (no se puede recordar la respuesta)', () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    } as unknown as Storage
    expect(Instalar.rechazado()).toBe(true)
    expect(() => Instalar.noOfrecerMas()).not.toThrow()
  })
})
