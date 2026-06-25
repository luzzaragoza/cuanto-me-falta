import type { Perfil } from '../types'
import { iniciales } from '../domain/selectors'

export function Avatar({ perfil, onClick }: { perfil?: Perfil; onClick: () => void }) {
  return (
    <button className="avatar" onClick={onClick} title="Editar perfil" aria-label="Editar perfil">
      {perfil?.photo ? (
        <img src={perfil.photo} alt="" />
      ) : (
        <span>{iniciales(perfil?.name) || '·'}</span>
      )}
      <span className="avatar-edit" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
    </button>
  )
}
