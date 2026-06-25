import { useEffect, useState } from 'react'
import type { Perfil } from '../types'
import { iniciales } from '../domain/selectors'
import { resizePhoto } from '../lib/image'
import { store } from '../state/store'

interface Props {
  welcome: boolean
  perfil?: Perfil
  onClose: () => void
}

export function ProfileModal({ welcome, perfil, onClose }: Props) {
  const [name, setName] = useState(perfil?.name ?? '')
  const [photo, setPhoto] = useState(perfil?.photo ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      setPhoto(await resizePhoto(file))
    } catch {
      /* imagen inválida: la ignoramos */
    }
  }

  const save = () => {
    store.setPerfil({ name: name.trim(), photo })
    onClose()
  }

  // al saltear la bienvenida marcamos el perfil como "visto" (vacío) para no re-preguntar
  const skip = () => {
    if (welcome) store.setPerfil({ name: '', photo: '' })
    onClose()
  }

  return (
    <div
      className="modal show"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) skip()
      }}
    >
      <div className="sheet">
        <h2>{welcome ? '¡Bienvenida! 👋' : 'Editar perfil'}</h2>
        <p className="m-desc">
          Sumá tu nombre y, si querés, una foto. Queda guardado solo en este dispositivo.
        </p>

        <div className="ppick">
          <div className="pprev">
            {photo ? <img src={photo} alt="" /> : <span>{iniciales(name) || '·'}</span>}
          </div>
          <div>
            <label className="btn ghost">
              Subir foto
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  pick(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {photo && (
              <button className="lnk" style={{ marginLeft: 10 }} onClick={() => setPhoto('')}>
                Quitar
              </button>
            )}
            <div className="phint">Opcional · formato cuadrado recomendado</div>
          </div>
        </div>

        <label className="flabel" htmlFor="pname">
          Tu nombre
        </label>
        <input
          id="pname"
          type="text"
          placeholder="Cómo te llamás"
          maxLength={40}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
        />

        <div className="m-actions">
          <button className="lnk" onClick={skip}>
            {welcome ? 'Ahora no' : 'Cancelar'}
          </button>
          <button className="btn" onClick={save}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
