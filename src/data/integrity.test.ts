import { describe, it, expect } from 'vitest'
import { PLANES, PLAN_POR_DEFECTO, existePlan } from './planes'
import { Validacion } from '../lib/validarPlan'

// Red de seguridad de los DATOS: valida CADA plan cargado (no solo el default).
//
// Las reglas viven en `src/lib/validarPlan.ts` — compartidas con el editor de planes
// y con el arranque (un plan que llega del backend roto se descarta). Acá se afirma
// una sola cosa por plan: que los planes REALES del repo pasan sin errores.
//
// Que cada regla salte cuando corresponde se prueba aparte, en
// `src/lib/validarPlan.test.ts`, con planes roto a propósito. Antes esos invariantes
// solo se ejercitaban contra datos que los cumplían: nunca sabíamos si el chequeo
// servía o si estaba pasando de casualidad.

describe('integridad · registro de planes', () => {
  it('los ids de plan son únicos', () => {
    const ids = PLANES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('el plan por defecto existe en el registro', () => {
    expect(existePlan(PLAN_POR_DEFECTO)).toBe(true)
  })
})

for (const plan of PLANES) {
  describe(`integridad · ${plan.carrera} (${plan.codigo})`, () => {
    it('no tiene errores de validación', () => {
      // el mensaje es lo que se lee cuando falla, así que se afirma sobre los textos
      expect(new Validacion(plan).errores.map((e) => `[${e.regla}] ${e.mensaje}`)).toEqual([])
    })

    it('sus avisos están revisados (ninguno inesperado)', () => {
      // Los avisos no bloquean, pero uno nuevo merece una mirada: si aparece algo
      // fuera de esta lista, es un dato que cambió y hay que decidir si está bien.
      const esperados = new Set(['nombre-duplicado', 'sin-titulos', 'anio-sin-materias'])
      const raros = new Validacion(plan).hallazgos
        .filter((x) => x.severidad === 'aviso' && !esperados.has(x.regla))
        .map((x) => x.mensaje)
      expect(raros).toEqual([])
    })
  })
}
