// Qué pantalla se monta: la app del alumno o la administración de planes.
//
// El ruteo es por HASH (`#admin`) y no por path (`/admin`) a propósito: el sitio se
// sirve estático desde GitHub Pages, donde una URL con path pide un archivo que no
// existe (404) salvo que se agregue el truco del 404.html. Con hash, funciona sin
// configurar nada y sigue andando offline con el service worker. Además la analítica
// ya está configurada para ignorar el hash, así que esto no ensucia las métricas.
//
// La administración va en un chunk aparte y NO se precarga: el 99,9% de las visitas
// son de alumnos y no tienen por qué descargarla.

import { lazy, Suspense, useEffect, useState } from 'react'
import { App } from './App'
import type { Vista } from './admin/AdminApp'

const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))

/** `admin` y sus sub-rutas (`admin/planes`, …). Se resuelve acá sin importar el chunk. */
const vistaAdmin = (ruta: string): Vista => {
  const sub = ruta.replace(/^admin\/?/, '')
  return sub === 'planes' || sub === 'permisos' || sub === 'resultados' ? sub : 'inicio'
}

const rutaActual = (): string => location.hash.replace(/^#\/?/, '').toLowerCase()

export function Root() {
  const [ruta, setRuta] = useState(rutaActual)

  useEffect(() => {
    const alCambiar = (): void => setRuta(rutaActual())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  if (ruta === 'admin' || ruta.startsWith('admin/')) {
    return (
      <Suspense fallback={<div className="adm-cargando" aria-label="Abriendo la administración…" />}>
        <AdminApp vista={vistaAdmin(ruta)} />
      </Suspense>
    )
  }
  return <App />
}
