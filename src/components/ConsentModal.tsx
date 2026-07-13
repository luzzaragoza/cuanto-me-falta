import { aceptarConsentimiento, rechazarConsentimiento } from '../state/sync'

const base = import.meta.env.BASE_URL

/**
 * Gate de consentimiento (una vez por cuenta, antes del primer sync): explica
 * qué se guarda en el servidor y pide aceptar los Términos y la Privacidad.
 * "Salir de la cuenta" cierra sesión y la app sigue 100% local — nada se subió.
 */
export function ConsentModal() {
  return (
    <div className="modal show">
      <div className="sheet">
        <h2>Antes de sincronizar</h2>
        <p className="m-desc">
          Para que tu avance te siga entre dispositivos, lo guardamos en tu cuenta:
          el estado de tus materias, tus notas, los nombres de tus optativas y tu
          nombre de perfil. Nadie más puede verlo — ni siquiera otras cuentas.
        </p>
        <p className="m-desc">
          Podés leer los{' '}
          <a href={`${base}terminos.html`} target="_blank" rel="noreferrer">
            Términos de uso
          </a>{' '}
          y la{' '}
          <a href={`${base}privacidad.html`} target="_blank" rel="noreferrer">
            Política de Privacidad
          </a>
          .
        </p>

        <div className="m-actions">
          <button className="lnk" onClick={rechazarConsentimiento}>
            Salir de la cuenta
          </button>
          <button className="btn" onClick={aceptarConsentimiento}>
            Acepto y sincronizo
          </button>
        </div>
      </div>
    </div>
  )
}
