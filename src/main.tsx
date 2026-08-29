import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { Root } from './Root.tsx'
import { Analytics } from './lib/analytics'
import { Sync } from './state/sync'
import { RefrescoDePlanes } from './state/planesRemoto'
import { toast } from './lib/toast'

Analytics.iniciar() // inyecta el proveedor (registra el flush de la cola en su load)
Analytics.pwa() // instalación/uso como app instalada (no-op sin analytics)
Analytics.sesion() // retención: día activo + regreso (la vuelta-a-mirar)
Sync.iniciar() // no-op sin backend configurado (dev/CI sin credenciales)
// Planes del backend al caché, en idle. No reemplaza nada en caliente: si el plan que
// estás mirando cambió, se avisa y decidís vos cuándo — nada se mueve debajo del mouse.
RefrescoDePlanes.programar(() => {
  toast.show(
    'Hay una versión nueva de tu plan de estudios.',
    'info',
    { label: 'Actualizar', run: () => location.reload() },
    20000, // vive más que un toast normal: es lo único que dice que hay algo nuevo
  )
})

// PWA: registrar el service worker solo en producción (en dev molesta con el cache).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
