import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { Root } from './Root.tsx'
import { Analytics } from './lib/analytics'
import { Sync } from './state/sync'
import { RefrescoDePlanes } from './state/planesRemoto'

Analytics.iniciar() // inyecta el proveedor (registra el flush de la cola en su load)
Analytics.pwa() // instalación/uso como app instalada (no-op sin analytics)
Analytics.sesion() // retención: día activo + regreso (la vuelta-a-mirar)
Sync.iniciar() // no-op sin backend configurado (dev/CI sin credenciales)
RefrescoDePlanes.programar() // planes del backend al caché, en idle (no toca esta sesión)

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
