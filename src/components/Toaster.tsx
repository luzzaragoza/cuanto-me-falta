import { toast, useToasts } from '../lib/toast'

/** Contenedor fijo (abajo-centro) que muestra los avisos flotantes. */
export function Toaster() {
  const items = useToasts()
  if (items.length === 0) return null
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <button
            className="toast-x"
            type="button"
            onClick={() => toast.dismiss(t.id)}
            aria-label="Cerrar aviso"
          >
            ×
          </button>
          <span className="toast-msg">{t.msg}</span>
          {t.action && (
            <button
              className="toast-act"
              type="button"
              onClick={() => {
                t.action?.run()
                toast.dismiss(t.id)
              }}
            >
              {t.action.label} →
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
