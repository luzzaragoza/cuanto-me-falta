import type { PlanDef } from '../model'

// UADE · Plan 1121 (2021) · Tecnicatura Universitaria en Desarrollo de Software.
// Cargado a mano desde el plan oficial, puede tener errores. Carrera corta:
// 3 años pero solo hasta el 1° cuatrimestre del 3° (5 cuatrimestres, 20 materias).
// Título: Técnico Universitario en Desarrollo de Software (al terminar 3°).
export const desarrolloSoftware: PlanDef = {
  id: 'uade-tec-desarrollo-software',
  universidad: 'uade',
  codigo: '1121',
  anio: 2021,
  carrera: 'Tecnicatura en Desarrollo de Software',
  titulos: [{ nombre: 'Técnico Universitario en Desarrollo de Software', hastaAnio: 3 }],
  materias: [
    // 1° año
    { cod: '3.4.225', nom: 'Introducción a la Algoritmia', anio: 1, cuatri: 1 },
    { cod: '3.4.164', nom: 'Sistemas de Información I', anio: 1, cuatri: 1 },
    { cod: '3.4.072', nom: 'Arquitectura de Computadores', anio: 1, cuatri: 1 },
    { cod: '3.4.226', nom: 'Diseño y Desarrollo Web', anio: 1, cuatri: 1 },
    { cod: '3.4.227', nom: 'Algoritmos y Estructuras de Datos I', anio: 1, cuatri: 2 },
    { cod: '3.4.207', nom: 'Sistemas de Información II', anio: 1, cuatri: 2 },
    { cod: '3.4.075', nom: 'Sistemas Operativos', anio: 1, cuatri: 2 },
    { cod: '3.4.228', nom: 'Testing de Aplicaciones', anio: 1, cuatri: 2 },
    // 2° año
    { cod: '3.4.229', nom: 'Algoritmos y Estructuras de Datos II', anio: 2, cuatri: 1 },
    { cod: '3.4.208', nom: 'Paradigma Orientado a Objetos', anio: 2, cuatri: 1 },
    { cod: '3.4.230', nom: 'Redes de Datos', anio: 2, cuatri: 1 },
    { cod: '3.4.209', nom: 'Ingeniería de Datos I', anio: 2, cuatri: 1 },
    { cod: 'OPT1', nom: 'Optativa I', anio: 2, cuatri: 2, opt: true },
    { cod: '3.4.231', nom: 'Diseño y Análisis de Algoritmos', anio: 2, cuatri: 2 },
    { cod: '3.4.210', nom: 'Proceso de Desarrollo de Software', anio: 2, cuatri: 2 },
    { cod: '3.4.082', nom: 'Aplicaciones Interactivas', anio: 2, cuatri: 2 },
    // 3° año (solo 1° cuatrimestre)
    { cod: 'OPT2', nom: 'Optativa II', anio: 3, cuatri: 1, opt: true },
    { cod: '3.4.216', nom: 'Desarrollo de Aplicaciones I', anio: 3, cuatri: 1 },
    { cod: '3.4.213', nom: 'Ingeniería de Datos II', anio: 3, cuatri: 1 },
    { cod: '3.4.232', nom: 'Trabajo Integrador Final', anio: 3, cuatri: 1 },
  ],
  correlativas: [
    { cod: '3.4.227', requiere: '3.4.225' },
    { cod: '3.4.207', requiere: '3.4.164' },
    { cod: '3.4.075', requiere: '3.4.072' },
    { cod: '3.4.229', requiere: '3.4.227' },
    { cod: '3.4.231', requiere: '3.4.229' },
    { cod: '3.4.210', requiere: '3.4.208' },
    { cod: '3.4.082', requiere: '3.4.208' },
    { cod: '3.4.216', requiere: '3.4.082' },
    { cod: '3.4.213', requiere: '3.4.209' },
    { cod: '3.4.232', requiere: '3.4.082' },
    { cod: '3.4.232', requiere: '3.4.209' },
  ],
}
