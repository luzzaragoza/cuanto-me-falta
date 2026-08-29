// Los guiones del tutorial de la administración.
//
// Existe por el Gate C: la prueba de fuego es que **alguien que no sea Luz** cargue una
// carrera de una universidad ajena en menos de dos horas, con la pantalla y un manual.
// Un tutorial en contexto vale más que media página de manual, porque se lee justo
// cuando hace falta y sobre el elemento real.
//
// DOS TOURS CORTOS, NO UNO LARGO. La lista y el editor son dos momentos distintos, con
// otro vocabulario y separados por varios minutos de trabajo. Un tour de nueve pasos se
// saltea entero; dos de tres o cuatro se leen. Cada uno tiene su propia marca de "visto".
//
// Y el del editor explica SOLO lo que la franja de pasos no dice. La franja ya se encarga
// de "qué hacer ahora y cuánto falta"; repetirlo en un globo sería ruido. Lo que la franja
// no puede decir es *cómo*: que se escribe inline, dónde se marcan las correlativas, y que
// antes de publicar se puede ver exactamente qué va a cambiar para los alumnos.
//
// ⚠️ El paso de correlativas queda pendiente de reescritura: Luz está rediseñando esa
// pestaña (12-ago). El texto de acá describe lo que hay HOY para no mentir mientras tanto,
// pero no es el definitivo.

import type { Step } from '../components/tourPasos'

/** Marcas de "ya lo vi", por tour. */
export const TOUR_LISTA_KEY = 'cmf-tour-admin'
export const TOUR_EDITOR_KEY = 'cmf-tour-editor'

export function tourVisto(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return true // sin storage no insistimos en cada carga
  }
}

export function marcarTourVisto(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* modo incógnito, etc. */
  }
}

/** La lista de planes: qué estás viendo y por dónde se empieza. */
export const PASOS_LISTA: Step[] = [
  {
    sel: '.adm-uni-head',
    titulo: 'Tus universidades',
    texto:
      'Cada bloque es una universidad con sus carreras. Al lado del nombre ves cuántos planes puede tener, según lo acordado con la facultad.',
  },
  {
    sel: '.adm-plan-estado',
    titulo: 'Qué ven los alumnos',
    texto:
      'La etiqueta dice qué versión están viendo. Mientras editás, siguen viendo la anterior: nunca se quedan sin el plan.',
  },
  {
    sel: '.adm-nuevo',
    titulo: 'Cargar una carrera',
    texto:
      'Acá arranca un plan nuevo. Queda en borrador hasta que vos lo publiques, así que podés cargarlo de a poco y sin apuro.',
    cta: true,
    ctaTexto: 'Entendido',
  },
]

/** El editor: cómo se carga, que es lo que la franja de pasos no puede decir. */
export const PASOS_EDITOR: Step[] = [
  {
    sel: '.ed-pasos',
    titulo: 'Dónde estás',
    texto:
      'Los dos pasos de la carga te dicen qué hacer ahora y cuánto falta. Se marcan solos a medida que cargás; tocá cualquiera para ir ahí. Publicar es aparte: se hace cuando terminaste.',
  },
  {
    sel: '.ed-fila',
    titulo: 'Se escribe acá directo',
    texto:
      'Código y nombre se editan en la fila misma: escribís y Tab pasa al siguiente. Se guarda solo, no hay botón de guardar.',
  },
  {
    sel: '.ed-tabs',
    titulo: 'Qué necesita cada materia',
    texto:
      'En la pestaña Correlativas cada materia dice en palabras qué hay que tener antes. Abrís una y elegís sus previas; solo se ofrecen las de cuatrimestres anteriores, así no podés cargar una imposible.',
  },
  {
    sel: '.ed-abrir-pub',
    titulo: 'Antes de publicar',
    texto:
      'Acá ves exactamente qué va a cambiar para los alumnos, y podés deshacer cualquier cosa. El botón de publicar está al pie de ese panel.',
    cta: true,
    ctaTexto: 'Empezar a cargar',
  },
]
