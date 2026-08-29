// El guion del tutorial: qué se resalta y qué dice.
//
// Vive aparte del componente porque el fast refresh de React deja de funcionar en un
// archivo que exporta componentes Y constantes — y porque los pasos son parte de cada
// pantalla, no del mecanismo que los muestra.

export interface Step {
  /** Selector del elemento real a resaltar. Si no existe, el paso se saltea. */
  sel: string
  titulo: string
  texto: string
  /** Paso de cierre: el botón primario invita a ACTUAR, no a avanzar. */
  cta?: boolean
  /** Texto del botón en el paso de cierre. */
  ctaTexto?: string
  /**
   * Qué se puede tocar directo en el paso de cierre. El overlay deja pasar los clics,
   * así que si el spotlight invita a tocar algo, tocarlo tiene que funcionar.
   */
  ctaSel?: string
}

/** Los pasos del alumno. Viven acá porque son parte de la app, no del componente. */
export const PASOS_ALUMNO: Step[] = [
  {
    sel: '#plan .mat',
    titulo: 'Marcá tus materias',
    texto: 'Tocá una materia para poner su estado: pendiente, cursando, pend. de final o aprobada.',
  },
  {
    sel: '#plan .corr-btn',
    titulo: 'Correlativas',
    texto: 'Este botón te muestra qué necesitás antes de una materia y qué habilita después.',
  },
  {
    sel: '.nav-tiles .nav-tile:first-child',
    titulo: 'Árbol de correlativas',
    texto: 'Tocá una materia y vas a ver toda su cadena: lo que necesitás y lo que habilita.',
  },
  {
    sel: '.nav-tiles .nav-tile:last-child',
    titulo: 'Notas',
    texto: 'Cargá la nota de las materias aprobadas y mirá tu promedio.',
  },
  {
    sel: '.head .actions',
    titulo: 'Opciones',
    texto: 'Exportá un PDF o un backup, cambiá de carrera y más.',
  },
  {
    sel: '#plan .mat',
    titulo: '¡Ahora probá vos!',
    texto: 'Empezá por esta: tocala y marcá cómo la llevás. Tu avance se calcula solo.',
    cta: true,
    ctaTexto: 'Marcar una materia',
    ctaSel: '.mat',
  },
]
