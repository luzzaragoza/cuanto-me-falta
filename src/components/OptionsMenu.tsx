import { useEffect, useRef, useState } from 'react'
import { store } from '../state/store'
import { download, printSummary, slug } from '../lib/io'
import { track } from '../lib/analytics'

// URL del formulario de feedback (Tally). Si no está configurada, no se muestra el botón.
const feedbackUrl = (import.meta.env as Record<string, string | undefined>).VITE_FEEDBACK_URL

const IconMenu = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
)

export function OptionsMenu() {
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
    track('backup_exportado')
    const name = store.getSnapshot().profile?.name
    download(`plan-uade-${slug(name)}.json`, store.exportar())
    setOpen(false)
  }

  const openFeedback = () => {
    setOpen(false)
    track('feedback_abierto')
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
        Opciones
      </button>

      {open && (
        <div className="menu" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              track('pdf_exportado')
              printSummary()
            }}
          >
            Exportar resumen (PDF)
          </button>
          <button role="menuitem" onClick={exportBackup}>
            Exportar backup (.json)
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              fileRef.current?.click()
            }}
          >
            Importar backup
          </button>
          {feedbackUrl && (
            <>
              <div className="menu-sep" />
              <button role="menuitem" onClick={openFeedback}>
                Enviar feedback
              </button>
            </>
          )}
          <div className="menu-sep" />
          <button role="menuitem" className="danger" onClick={reset}>
            Reiniciar todo
          </button>
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
