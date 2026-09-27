import { useEffect, useRef, useState } from 'react'
import { store } from '../state/store'
import { Archivo } from '../lib/io'
import { Analytics } from '../lib/analytics'

// URL del formulario de feedback (Tally). Si no está configurada, no se muestra el botón.
const feedbackUrl = (import.meta.env as Record<string, string | undefined>).VITE_FEEDBACK_URL

const IconMenu = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

// Íconos de cada entrada. Van en un <span class="mi-ico"> para que el menú alinee
// texto contra texto aunque alguno falte.
const ico = (d: string, extra?: string) => () => (
  <span className="mi-ico" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {extra && <path d={extra} />}
    </svg>
  </span>
)
const IcoPdf = ico('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5M9 13h6M9 17h4')
// Exportar e importar son AFUERA y ADENTRO, y así hay que dibujarlos: la etiqueta
// dice "Exportar" y una flecha que baja se lee al revés (reporte de Luz, 8-sep).
// Pero darlos vuelta sin más tampoco iba: ⬆ sobre una base ES el ícono de SUBIR A
// LA NUBE, y esta app tiene cuenta con sincronización — "Exportar backup" con esa
// flecha invita a pensar que el archivo se guarda en la cuenta. Y la otra salida
// habitual, el corchete con flecha horizontal, es CERRAR SESIÓN (mirado renderizado
// al lado de los otros: se lee exactamente así, y acá hay login de Google).
// Queda la diagonal saliendo de / entrando a una bandeja: dice afuera y adentro sin
// pisar ninguna de las dos convenciones verticales. Los nombres tampoco hablan más
// de arriba y abajo, para que nadie los "corrija" de vuelta.
const BANDEJA = 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'
const IcoExportar = ico(BANDEJA, 'M8 10L16 3M11 3h5v5')
const IcoImportar = ico(BANDEJA, 'M16 3L8 10M13 10H8V5')
const IcoTutorial = () => (
  <span className="mi-ico" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.7-.9 1.3v.4" />
      <circle cx="12" cy="17" r="0.6" />
    </svg>
  </span>
)
const IcoFeedback = ico('M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z')
const IcoReiniciar = ico('M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5')

export function OptionsMenu({ onVerTutorial }: { onVerTutorial: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // se difiere para que el click que abre el menú no lo cierre en el mismo evento
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const exportBackup = () => {
    Analytics.evento('backup_exportado')
    const name = store.getSnapshot().profile?.name
    Archivo.descargar(`plan-uade-${Archivo.slug(name)}.json`, store.exportar())
    setOpen(false)
  }

  const openFeedback = () => {
    setOpen(false)
    Analytics.evento('feedback_abierto')
    if (feedbackUrl) window.open(feedbackUrl, '_blank', 'noopener,noreferrer')
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const ok = store.importar(String(reader.result))
      if (!ok) alert('No pude leer el archivo. Tiene que ser un .json exportado desde acá.')
    }
    reader.readAsText(file)
  }

  const reset = () => {
    setOpen(false)
    if (confirm('¿Reiniciar todo? Se borran estados y notas (tu perfil se conserva).')) {
      store.reset()
    }
  }

  return (
    <div className="actions" ref={ref}>
      <button
        className="tool-btn"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <IconMenu />
        <span className="tb-label">Opciones</span>
      </button>

      {open && (
        <div className="menu" role="menu">
          {/* Dos secciones con nombre: lo que le pasa a TU PLAN (se lleva datos
              afuera o los trae) y lo que le pasa a LA APP. Antes eran seis
              botones seguidos separados por dos rayas mudas. */}
          <div className="menu-kicker">Tu plan</div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              Analytics.evento('pdf_exportado')
              Archivo.imprimirResumen()
            }}
          >
            <IcoPdf />
            Exportar resumen (PDF)
          </button>
          <button role="menuitem" onClick={exportBackup}>
            <IcoExportar />
            Exportar backup (.json)
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              fileRef.current?.click()
            }}
          >
            <IcoImportar />
            Importar backup
          </button>

          <div className="menu-sep" />
          <div className="menu-kicker">La app</div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onVerTutorial()
            }}
          >
            <IcoTutorial />
            Ver el tutorial
          </button>
          {feedbackUrl && (
            <button role="menuitem" onClick={openFeedback}>
              <IcoFeedback />
              Enviar feedback
            </button>
          )}

          <div className="menu-sep" />
          <button role="menuitem" className="danger" onClick={reset}>
            <IcoReiniciar />
            Reiniciar todo
          </button>

          {/* Versión: para saber si el dispositivo tiene la última (la PWA instalada
              puede quedar con una vieja en caché) y para que un reporte de feedback
              venga con el dato. No es un botón: es una firma al pie. */}
          <div className="menu-ver" title="Versión instalada en este dispositivo">
            v{__APP_VERSION__}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
