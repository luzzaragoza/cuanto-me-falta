import { describe, it, expect } from 'vitest'
import { decidirSesion } from './analytics'

// Retención de una app "para entrar a mirar": el valor es VOLVER, no editar.
// `decidirSesion` es pura (fecha + flags → qué eventos disparar y qué persistir).
describe('decidirSesion — medir la vuelta-a-mirar', () => {
  it('1ª vez de todas: cuenta el día, fija primer-día, no es regreso', () => {
    const d = decidirSesion('2026-07-21', {
      primerDia: null,
      ultimoDia: null,
      yaRegreso: false,
      activada: false,
    })
    expect(d.diaActivo).toBe(true)
    expect(d.nuevoPrimerDia).toBe('2026-07-21')
    expect(d.nuevoUltimoDia).toBe('2026-07-21')
    expect(d.regreso).toBe(false)
  })

  it('2ª apertura el MISMO día: no cuenta de nuevo ni toca nada', () => {
    const d = decidirSesion('2026-07-21', {
      primerDia: '2026-07-21',
      ultimoDia: '2026-07-21',
      yaRegreso: false,
      activada: true,
    })
    expect(d.diaActivo).toBe(false)
    expect(d.regreso).toBe(false)
    expect(d.nuevoUltimoDia).toBe(null)
    expect(d.nuevoPrimerDia).toBe(null)
  })

  it('vuelve OTRO día habiendo armado su plan: dispara regreso', () => {
    const d = decidirSesion('2026-07-22', {
      primerDia: '2026-07-21',
      ultimoDia: '2026-07-21',
      yaRegreso: false,
      activada: true,
    })
    expect(d.diaActivo).toBe(true)
    expect(d.regreso).toBe(true)
    expect(d.marcarRegreso).toBe(true)
  })

  it('vuelve otro día pero NUNCA marcó nada: cuenta el día, no es regreso', () => {
    const d = decidirSesion('2026-07-22', {
      primerDia: '2026-07-21',
      ultimoDia: '2026-07-21',
      yaRegreso: false,
      activada: false,
    })
    expect(d.diaActivo).toBe(true)
    expect(d.regreso).toBe(false)
  })

  it('ya había regresado antes: cuenta el día pero NO repite regreso', () => {
    const d = decidirSesion('2026-07-25', {
      primerDia: '2026-07-21',
      ultimoDia: '2026-07-23',
      yaRegreso: true,
      activada: true,
    })
    expect(d.diaActivo).toBe(true)
    expect(d.regreso).toBe(false)
  })
})
