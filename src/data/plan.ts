import type { AnioDef } from '../types'

// Plan 1621 — Ingeniería en Informática (UADE). Cargado a mano, puede tener errores.
// 5 años × 2 cuatrimestres. Solo Analista (3°) e Ingeniero (5°) como títulos.
export const PLAN: AnioDef[] = [
  {
    year: 1,
    cuatris: [
      {
        n: 1,
        mats: [
          { cod: '3.4.069', nom: 'Fundamentos de Informática' },
          { cod: '3.4.164', nom: 'Sistemas de Información I' },
          { cod: '2.1.002', nom: 'Pensamiento Crítico y Comunicación' },
          { cod: '3.4.043', nom: 'Teoría de Sistemas' },
          { cod: '3.1.050', nom: 'Elementos de Álgebra y Geometría' },
        ],
      },
      {
        n: 2,
        mats: [
          { cod: '3.4.071', nom: 'Programación I' },
          { cod: '3.3.121', nom: 'Sistemas de Representación' },
          { cod: '3.2.178', nom: 'Fundamentos de Química' },
          { cod: '3.4.072', nom: 'Arquitectura de Computadores' },
          { cod: '3.1.024', nom: 'Matemática Discreta' },
          { cod: '3.1.051', nom: 'Álgebra' },
        ],
      },
    ],
  },
  {
    year: 2,
    cuatris: [
      {
        n: 1,
        mats: [
          { cod: '3.4.074', nom: 'Programación II' },
          { cod: '3.4.207', nom: 'Sistemas de Información II' },
          { cod: '3.4.075', nom: 'Sistemas Operativos' },
          { cod: '3.1.052', nom: 'Física I' },
          { cod: '3.1.053', nom: 'Cálculo I' },
        ],
      },
      {
        n: 2,
        mats: [
          { cod: '3.4.077', nom: 'Programación III' },
          { cod: '3.4.208', nom: 'Paradigma Orientado a Objetos' },
          { cod: '3.4.078', nom: 'Fundamentos de Telecomunicaciones' },
          { cod: '3.4.209', nom: 'Ingeniería de Datos I' },
          { cod: '3.1.054', nom: 'Cálculo II' },
        ],
      },
    ],
  },
  {
    year: 3,
    titulo: 'Analista en Informática',
    cuatris: [
      {
        n: 1,
        mats: [
          { cod: '3.4.210', nom: 'Proceso de Desarrollo de Software' },
          { cod: '3.4.211', nom: 'Seminario de Integración Profesional' },
          { cod: '3.4.212', nom: 'Teleinformática y Redes' },
          { cod: '3.4.213', nom: 'Ingeniería de Datos II' },
          { cod: '3.1.049', nom: 'Probabilidad y Estadística' },
          { cod: '2.4.216', nom: 'Examen de Inglés' },
        ],
      },
      {
        n: 2,
        mats: [
          { cod: '3.4.082', nom: 'Aplicaciones Interactivas' },
          { cod: '3.4.214', nom: 'Ingeniería de Software' },
          { cod: '3.1.055', nom: 'Física II' },
          { cod: '3.4.215', nom: 'Teoría de la Computación' },
          { cod: '3.1.056', nom: 'Estadística Avanzada' },
        ],
      },
    ],
  },
  {
    year: 4,
    cuatris: [
      {
        n: 1,
        mats: [
          { cod: '3.4.216', nom: 'Desarrollo de Aplicaciones I' },
          { cod: '3.4.089', nom: 'Dirección de Proyectos Informáticos' },
          { cod: '3.4.217', nom: 'Ciencia de Datos' },
          { cod: '3.4.092', nom: 'Seguridad e Integridad de la Información' },
          { cod: '3.1.025', nom: 'Modelado y Simulación' },
        ],
      },
      {
        n: 2,
        mats: [
          { cod: 'OPT1', nom: 'Optativa I' },
          { cod: '3.4.218', nom: 'Desarrollo de Aplicaciones II' },
          { cod: '3.4.086', nom: 'Evaluación de Proyectos Informáticos' },
          { cod: '3.4.096', nom: 'Inteligencia Artificial' },
          { cod: '3.4.219', nom: 'Tecnología y Medio Ambiente' },
          { cod: 'PPS06', nom: 'Práctica Profesional Supervisada' },
        ],
      },
    ],
  },
  {
    year: 5,
    titulo: 'Ingeniero en Informática',
    cuatris: [
      {
        n: 1,
        mats: [
          { cod: 'OPT2', nom: 'Optativa II' },
          { cod: '3.4.094', nom: 'Arquitectura de Aplicaciones' },
          { cod: '3.4.220', nom: 'Tendencias Tecnológicas' },
          { cod: '3.4.100', nom: 'Proyecto Final de Ingeniería en Informática' },
          { cod: '3.4.098', nom: 'Calidad de Software' },
        ],
      },
      {
        n: 2,
        mats: [
          { cod: 'OPT3', nom: 'Optativa III' },
          { cod: '3.4.221', nom: 'Negocios Tecnológicos' },
          { cod: '3.4.135', nom: 'Tecnología e Innovación' },
          { cod: '2.3.056', nom: 'Derecho Informático' },
        ],
      },
    ],
  },
]
