/**
 * La marca: un casillero pintado con resaltador y el "¿" en tinta.
 *
 * El signo NO es texto: es el contorno del "¿" de Archivo ExtraBold, convertido a
 * trazo. Con `<text>` el logo dependía de que la fuente estuviera cargada —y en el
 * favicon o en el ícono instalado no lo está nunca—, así que cada lugar lo dibujaba
 * con la serif que tuviera a mano. El mismo trazo vive en `public/favicon.svg` y en
 * `scripts/gen-icons.mjs`: si cambia acá, cambia allá.
 */
export const TRAZO_PREGUNTA =
  'M327 172Q275 172 232 163Q189 154 156 137Q123 120 100.5 96.5Q78 73 66.5 43.5Q55 14 55-20Q55-58 69-87Q83-116 105-137.5Q127-159 152-176Q177-193 199-208Q221-223 235-238Q249-253 249-272L249-293L414-293L414-250Q414-224 401.5-203.5Q389-183 370-166Q351-149 329-133.5Q307-118 287.5-102.5Q268-87 255.5-69Q243-51 243-28Q243-15 248.5-1.5Q254 12 265.5 22.5Q277 33 296 39.5Q315 46 343 46Q378 46 399.5 37Q421 28 432.5 14.5Q444 1 448.5-15.5Q453-32 453-46Q453-54 452.5-60.5Q452-67 451-73L617-73Q619-65 620-56Q621-47 621-36Q621 0 608 31.5Q595 63 570.5 88.5Q546 114 510.5 133Q475 152 429 162Q383 172 327 172M426-356L235-356L235-527L426-527Z'

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="22" fill="var(--resalta)" />
      {/* El trazo viene en unidades de la fuente (1000/em), con la línea de base en 0:
          se escala a 58 de alto y se centra en el casillero. */}
      <path d={TRAZO_PREGUNTA} transform="translate(21.95 64.73) scale(0.083)" fill="var(--tinta)" />
    </svg>
  )
}
