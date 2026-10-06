// La barra de arriba de todas las pantallas institucionales (diseño de Luz, 28-sep).
//
// Una sola pieza con dos lados: a la izquierda la marca (el "¿" en su círculo, el título
// en Caprasimo y el kicker en versalitas), a la derecha lo que cada pantalla necesite.
// El diseño no pone lo mismo en todas —el inicio muestra quién sos, la lista de planes
// lleva la identidad al hero y deja arriba solo la vuelta—, así que el lado derecho entra
// por `children` y no se adivina acá.

import type { ReactNode } from 'react'
import { Auth } from '../state/auth'
import type { SesionAdmin } from '../lib/admin'

export function Cabecera({
  titulo,
  kicker,
  children,
}: {
  titulo: string
  kicker: string
  children?: ReactNode
}) {
  return (
    <header className="adm-head">
      <div className="adm-head-in">
        <div className="adm-brand">
          <span className="adm-mark">¿</span>
          <span className="adm-titulo">
            {titulo}
            <span className="adm-kicker">{kicker}</span>
          </span>
        </div>
        {children && <div className="adm-acc">{children}</div>}
      </div>
    </header>
  )
}

/**
 * Mail + rol + Salir, en una línea. El rol viaja como píldora con un punto de color:
 * naranja el superadmin, oliva el admin de una universidad (con su sigla, porque un
 * admin es admin DE algo).
 */
export function Quien({
  mail,
  sesion,
  sigla,
  salir = true,
  children,
}: {
  mail: string | undefined
  sesion: SesionAdmin | null
  /** Para el admin de universidad: "admin · UADE". */
  sigla?: string
  /** Permisos y cupos no lo lleva: ahí la única salida es volver al inicio. */
  salir?: boolean
  /** Lo que va entre el rol y Salir (el enlace a permisos del superadmin, p. ej.). */
  children?: ReactNode
}) {
  return (
    <span className="adm-quien">
      {mail && <span className="adm-mail">{mail}</span>}
      {sesion && (
        <span className={`adm-rol ${sesion.esSuper ? 'super' : ''}`}>
          {sesion.esSuper ? 'superadmin' : sigla ? `admin · ${sigla}` : 'admin'}
        </span>
      )}
      {children}
      {salir && (
        <button className="adm-salir" onClick={() => void Auth.salir()}>
          Salir
        </button>
      )}
    </span>
  )
}
