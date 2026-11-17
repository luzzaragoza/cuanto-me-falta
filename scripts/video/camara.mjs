// La cámara: cómo se encuadra el celular en cada instante.
//
// El celular no es una imagen quieta: se acerca, se aleja y corta de un plano a
// otro. Acá se decide adónde mira y cuándo; componer.html solo interpola.
//
// Un plano es { k, tx, ty }: k es el zoom (1 = plano general) y (tx, ty) dónde
// cae la esquina de arriba a la izquierda del celular en el cuadro de 1080×1920.
// `plano(k, punto, destino)` lo arma al revés, que es como se piensa: "con este
// zoom, quiero que ESTE punto de la pantalla del celular caiga ACÁ en el cuadro".

/** Píxeles de video por cada píxel del celular, con zoom 1. */
export const ESCALA = 682 / 390

const plano = (k, [px, py], [fx, fy]) => ({ k, tx: fx - px * ESCALA * k, ty: fy - py * ESCALA * k })
const centro = (c) => [c.x + c.w / 2, c.y + c.h / 2]

/**
 * @param g      el guion (marcas de tiempo)
 * @param cajas  dónde está cada cosa en la pantalla del celular (de la captura)
 * @returns claves { t, k, tx, ty, e }: a cada clave se llega desde la anterior
 *          con la curva `e` ('corte' salta; 'suave' acelera y frena; 'sale'
 *          frena; 'rebote' se pasa un poco y vuelve; 'lineal' deriva pareja).
 */
export function construirCamara(g, cajas) {
  const M = g.marcas
  const R = M.revelacion
  const X = 490 // centro horizontal de la zona que TikTok deja libre

  // ── Los planos ──
  const GENERAL = plano(1, [0, 0], [199, 392]) // el celular entero
  // Titular + mapa. Se ancla en el borde de arriba del titular, que queda justo
  // debajo de la fecha: lo que está más arriba en la app se funde con el papel.
  const tablero = (k) => plano(k, [195, cajas.titular.y], [X, 455])
  const TITULAR = (k) => plano(k, centro(cajas.titular), [470, 570])
  // El bloque de 3° año dentro del mapa: ahí pasa el año que costó.
  const c3 = cajas.celdas['3.1.055'] // Física II, en el medio del bloque
  const TERCERO = plano(1.95, [cajas.mapa.x + c3.x + 7, cajas.mapa.y + c3.y - 4], [540, 720])
  const analista = (k) => plano(k, centro(cajas.analista), [X, 820])
  const fila = (k, y = 720) => plano(k, centro(cajas.fila), [X, y])
  const toque = (id) => g.toques.find((q) => q.id === id)
  const APROBADA = plano(1.72, [toque('aprobada').x + 20, toque('aprobada').y], [X, 900])
  const ingeniero = (k) => plano(k, centro(cajas.ingeniero), [X, 840])
  // El nudo: la fila con el final colgado, y su panel de correlativas debajo.
  const nudo = (k) => plano(k, [195, cajas.nudoFila.y + 105], [X, 880])
  // El árbol con una materia elegida: entra la cadena y, abajo, la ficha que
  // dice cuántas necesita y cuántas habilita.
  const arriba = cajas.arbolCadena.y0 - 14
  const kArbol = 1044 / (cajas.arbolFicha.y + cajas.arbolFicha.h + 6 - arriba) / ESCALA
  const arbol = (k) => plano(k, [195, arriba], [X, 446])
  const ficha = (k) => plano(k, centro(cajas.arbolFicha), [X, 1160])
  // El árbol aprobado, de punta a punta, y el promedio.
  const verde = (k) => plano(k, [195, (cajas.verde.y0 + cajas.verde.y1) / 2], [X, 870])
  const promedio = (k) => plano(k, centro(cajas.promedio), [X, 650])

  const claves = []
  const a = (t, p, e = 'suave') => claves.push({ t, ...p, e })
  /** Un respiro en el cambio de año: se aleja apenas y vuelve. */
  const respiro = (t, k = 1.47) => {
    a(t + 0.22, tablero(k - 0.07), 'sale')
    a(t + 0.7, tablero(k))
  }

  // 0 · Arranca pegado al titular: "Te faltan 52 materias". Después se aleja.
  a(0, TITULAR(1.9), 'corte')
  a(0.9, TITULAR(1.84), 'lineal')
  a(2.3, GENERAL)
  a(M.m1 - 0.1, plano(1.03, [195, 422], [X + 50, 392 + 422 * ESCALA]), 'lineal')

  // 1 y 2 · Se acerca al tablero: el mapa se pinta de violeta y después de verde.
  a(M.m1 + 0.6, tablero(1.44))
  a(M.dic1, tablero(1.47), 'lineal')
  respiro(M.dic1)
  a(M.m2 - 0.01, tablero(1.52), 'lineal')
  respiro(M.m2)
  a(M.dic2, tablero(1.49), 'lineal')
  respiro(M.dic2)
  a(M.m3 - 0.01, tablero(1.52), 'lineal')

  // 3 · El año que costó. En marzo, normal; en diciembre, un acercamiento muy
  // lento al bloque de 3° año mientras las notas tardan en llegar.
  respiro(M.m3)
  a(M.dic3 + 0.3, tablero(1.49), 'lineal')
  a(27.9, TERCERO, 'suave')
  a(28.8, tablero(1.47)) // vuelve para la abuela
  a(M.nudo - 0.01, tablero(1.5), 'lineal')

  // El nudo · La lista bajando, el panel de correlativas y el árbol.
  a(M.nudo, nudo(1.16), 'corte')
  a(M.finLista + 0.8, nudo(1.22), 'lineal')
  a(M.arbol - 0.01, nudo(1.32), 'lineal')
  a(M.arbol, arbol(kArbol), 'corte')
  a(M.finArbol, arbol(kArbol * 1.03), 'lineal')
  a(M.finArbol + 0.9, ficha(1.42)) // baja a la ficha: "Necesita 1 · Habilita 3"
  a(M.feb - 0.01, ficha(1.47), 'lineal')
  // Febrero: los dos finales, en verde.
  a(M.feb, tablero(1.55), 'corte')
  a(M.m4 - 0.01, tablero(1.47), 'lineal')

  // 4 · Vuelve el ritmo. Corte a la banda de Analista, y golpe de zoom cuando se pone verde.
  respiro(M.m4)
  a(M.dic4, tablero(1.49), 'lineal')
  respiro(M.dic4)
  a(M.analista - 0.81, tablero(1.5), 'lineal')
  a(M.analista - 0.8, analista(1.2), 'corte')
  a(M.analista, analista(1.27), 'lineal')
  a(M.analista + 0.4, analista(1.58), 'rebote')
  a(M.vuelta - 0.01, analista(1.64), 'lineal')
  a(M.vuelta, tablero(1.47), 'corte')
  a(M.m5 - 0.01, tablero(1.52), 'lineal')

  // 5 · Marzo: todo lo que queda, en violeta. Después la cuenta regresiva: con
  // cada golpe, un paso más cerca. Hasta 1,63: más que eso y los casilleros de
  // 4° y 5° quedan tapados por el número grande.
  respiro(M.m5)
  let k = 1.42
  a(M.cuenta + 0.5, tablero(k))
  let antes = M.cuenta + 0.5
  for (const golpe of M.golpes) {
    a(Math.max(antes + 0.01, golpe.cae - 0.02), tablero(k + 0.005), 'lineal')
    k += 0.038
    a(golpe.cae + 0.28, tablero(k), 'rebote')
    antes = golpe.cae + 0.28
  }
  a(M.m6 - 0.01, tablero(k + 0.025), 'lineal') // el "1" queda en pantalla y la cámara sigue entrando

  // 6 · La última. Corte a la fila, entra despacio hacia "Aprobada"… y se queda.
  a(M.m6, fila(1.26), 'corte')
  a(M.m6 + 1.15, fila(1.34), 'lineal')
  a(M.corte, APROBADA, 'suave')
  a(M.corte + 0.08, APROBADA, 'lineal')
  a(M.corte + 0.55, fila(1.5, 760)) // se cerró el selector: la fila, ya en verde
  a(R - 0.01, fila(1.57, 760), 'lineal') // el silencio: sigue entrando

  // La revelación: corte, y la cámara cae hacia atrás.
  a(R, tablero(1.85), 'corte')
  a(R + 0.75, tablero(1.47), 'sale')
  a(M.tIng - 0.01, tablero(1.38), 'lineal')
  // La vuelta olímpica: el título, el árbol entero y el promedio.
  a(M.tIng, ingeniero(1.25), 'corte')
  a(M.tIng + 0.45, ingeniero(1.55), 'rebote')
  a(M.tVerde - 0.01, ingeniero(1.62), 'lineal')
  a(M.tVerde, verde(1.4), 'corte')
  a(M.tNotas - 0.01, verde(1.54), 'lineal')
  a(M.tNotas, promedio(1.2), 'corte')
  a(M.tNotas + 0.45, promedio(1.45), 'rebote')
  a(M.cierre + 0.6, promedio(1.54), 'lineal')

  // Las claves tienen que quedar en orden: si no, la cámara salta a cualquier lado.
  claves.forEach((c, i) => {
    if (i && c.t < claves[i - 1].t) throw new Error(`Cámara desordenada en t = ${c.t} (viene de ${claves[i - 1].t})`)
  })

  // Lo que brilla o pulsa en un lugar de la pantalla (en píxeles del celular).
  const VERDE = '#1d8a57'
  const luces = {
    brillos: [
      { t: M.analista, caja: cajas.analista },
      { t: M.tIng + 0.3, caja: cajas.ingeniero },
      { t: M.tNotas + 0.3, caja: cajas.promedio },
    ],
    anillos: [
      { t: M.analista, caja: cajas.analista, color: VERDE },
      { t: M.corte + 0.2, caja: cajas.fila, color: VERDE },
      { t: M.tIng + 0.3, caja: cajas.ingeniero, color: VERDE },
      { t: M.arbol + 0.1, caja: cajas.arbolFoco, color: '#24388a' },
      { t: M.tNotas + 0.3, caja: cajas.promedio, color: '#f2cc1c' },
    ],
    // De dónde sale el papel picado chico del título de Analista.
    confetiDesde: centro(cajas.analista),
  }
  return { claves, luces }
}
