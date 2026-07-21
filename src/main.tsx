import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { App } from './App.tsx'
import { initAnalytics, trackPwa, trackSesion } from './lib/analytics'
import { initSync } from './state/sync'

initAnalytics() // inyecta el proveedor (registra el flush de la cola en su load)
trackPwa() // instalación/uso como app instalada (no-op sin analytics)
trackSesion() // retención: día activo + regreso (la vuelta-a-mirar)
initSync() // no-op sin backend configurado (dev/CI sin credenciales)

// PWA: registrar el service worker solo en producción (en dev molesta con el cache).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
