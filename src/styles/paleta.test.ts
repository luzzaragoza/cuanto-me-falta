import { describe, it, expect } from 'vitest'
import css from './global.css?raw'

// Guardia de la PALETA: que los estados se sigan distinguiendo por color.
//
// El rediseño del 2-sep dejó cursando y final en la misma familia naranja (ΔE 7,7: el
// mismo color a simple vista) y lo único que lo detectó fue el feedback de los usuarios.
// Un tono que no se distingue no rompe ningún test, no tipa mal y no falla en ningún
// navegador: por eso esto lee los tokens REALES de global.css y los mide.
//
// La vara es ΔE2000 (la distancia perceptual de la CIE), con la vista normal y con las
// dos formas comunes de daltonismo rojo-verde (Machado et al. 2009, severidad 1), y el
// contraste de WCAG. Tritanopia no se simula: es ~0,01% y ahí manda el glifo.

type Vision = 'normal' | 'protanopia' | 'deuteranopia'
type Lab = [number, number, number]

const MACHADO: Record<Exclude<Vision, 'normal'>, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
}

class Color {
  readonly hex: string
  readonly lineal: number[]

  constructor(hex: string) {
    this.hex = hex
    this.lineal = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
  }

  get luminancia(): number {
    const [r, g, b] = this.lineal
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  contraste(otro: Color): number {
    const [a, b] = [this.luminancia, otro.luminancia].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }

  distancia(otro: Color, vision: Vision = 'normal'): number {
    return Color.deltaE2000(Color.lab(this.vistoCon(vision)), Color.lab(otro.vistoCon(vision)))
  }

  private vistoCon(vision: Vision): number[] {
    if (vision === 'normal') return this.lineal
    return MACHADO[vision].map((f) =>
      Math.min(1, Math.max(0, f[0] * this.lineal[0] + f[1] * this.lineal[1] + f[2] * this.lineal[2])),
    )
  }

  static lab([r, g, b]: number[]): Lab {
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
  }

  static deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
    const rad = Math.PI / 180
    const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
    const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    const a1p = (1 + G) * a1
    const a2p = (1 + G) * a2
    const C1p = Math.hypot(a1p, b1)
    const C2p = Math.hypot(a2p, b2)
    const tono = (b: number, a: number) => {
      const h = Math.atan2(b, a) / rad
      return h < 0 ? h + 360 : h
    }
    const h1p = tono(b1, a1p)
    const h2p = tono(b2, a2p)
    let dh = 0
    if (C1p * C2p !== 0) {
      dh = h2p - h1p
      if (dh > 180) dh -= 360
      else if (dh < -180) dh += 360
    }
    const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad)
    const Lm = (L1 + L2) / 2
    const Cmp = (C1p + C2p) / 2
    let hm = h1p + h2p
    if (C1p * C2p !== 0) {
      hm = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2
    }
    const T =
      1 -
      0.17 * Math.cos((hm - 30) * rad) +
      0.24 * Math.cos(2 * hm * rad) +
      0.32 * Math.cos((3 * hm + 6) * rad) -
      0.2 * Math.cos((4 * hm - 63) * rad)
    const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2)
    const SC = 1 + 0.045 * Cmp
    const SH = 1 + 0.015 * Cmp * T
    const RT =
      -Math.sin(2 * 30 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad) * 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7))
    const [l, c, h] = [(L2 - L1) / SL, (C2p - C1p) / SC, dH / SH]
    return Math.sqrt(l ** 2 + c ** 2 + h ** 2 + RT * c * h)
  }
}

const token = (nombre: string): Color => {
  const m = css.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})\\b`))
  if (!m) throw new Error(`no encontré --${nombre} en global.css`)
  return new Color(m[1])
}

const VISIONES: Vision[] = ['normal', 'protanopia', 'deuteranopia']
const DISTINTOS = 20 // ΔE2000: a partir de ~10 dos colores se ven distintos de un vistazo

describe('paleta · la vara', () => {
  it('el ΔE2000 coincide con la tabla de referencia (Sharma, Wu y Dalal 2005)', () => {
    expect(Color.deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4)
    expect(Color.deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 4)
  })
})

describe('paleta · los estados se distinguen por color', () => {
  const ap = token('ap')
  const fi = token('fi')
  const cu = token('cu')

  for (const vision of VISIONES) {
    it(`cursando se separa de aprobada y de final (${vision})`, () => {
      expect(cu.distancia(ap, vision)).toBeGreaterThanOrEqual(DISTINTOS)
      expect(cu.distancia(fi, vision)).toBeGreaterThanOrEqual(DISTINTOS)
    })
  }

  it('aprobada y final se separan con la vista normal', () => {
    // Con protanopia el oliva y el terracota quedan a ΔE 7: ahí los separa el glifo (✓ vs ◐).
    expect(ap.distancia(fi)).toBeGreaterThanOrEqual(DISTINTOS)
  })

  it('un error no se lee como "cursando"', () => {
    for (const vision of VISIONES) {
      expect(token('peligro').distancia(cu, vision)).toBeGreaterThanOrEqual(DISTINTOS)
      expect(token('aviso').distancia(cu, vision)).toBeGreaterThanOrEqual(DISTINTOS)
    }
  })

  it('los tres colores de estado se ven sobre el papel y la tarjeta (WCAG 1.4.11, 3:1)', () => {
    for (const estado of [ap, fi, cu]) {
      expect(estado.contraste(token('paper'))).toBeGreaterThanOrEqual(3)
      expect(estado.contraste(token('card'))).toBeGreaterThanOrEqual(3)
    }
  })

  it('el texto de cada estado se lee sobre su fondo (WCAG 1.4.3, 4.5:1)', () => {
    expect(token('ap-tx').contraste(token('ap-bg'))).toBeGreaterThanOrEqual(4.5)
    expect(token('fi-tx').contraste(token('fi-bg'))).toBeGreaterThanOrEqual(4.5)
    expect(token('cu-tx').contraste(token('cu-bg'))).toBeGreaterThanOrEqual(4.5)
    expect(token('cu-medio').contraste(token('cu-bg-2'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('paleta · la hoja del PDF', () => {
  const cursando = token('px-cursando')

  it('el tramo de cursando se ve contra el riel de su barra (3:1)', () => {
    expect(cursando.contraste(token('px-riel'))).toBeGreaterThanOrEqual(3)
  })

  for (const vision of VISIONES) {
    it(`el tramo de cursando se separa del de final (${vision})`, () => {
      expect(cursando.distancia(token('fi'), vision)).toBeGreaterThanOrEqual(DISTINTOS)
    })
  }
})
