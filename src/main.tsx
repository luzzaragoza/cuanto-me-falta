import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { App } from './App.tsx'
import { initAnalytics } from './lib/analytics'
import { initSync } from './state/sync'

initAnalytics()
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
