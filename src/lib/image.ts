/**
 * Redimensiona una imagen a un cuadrado de `size`px (recorte centrado) y la
 * devuelve como data URL JPEG. Así la foto de perfil pesa poco en localStorage.
 */
export function resizePhoto(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No pude crear el contexto del canvas'))
        return
      }
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No pude leer la imagen'))
    }
    img.src = url
  })
}

/**
 * Baja una foto remota (p.ej. el avatar de Google al iniciar sesión) y la pasa por
 * el mismo resize a 256px, para guardarla en el perfil local como data URL.
 * Devuelve '' si falla (CORS, red, etc.) — la foto es opcional, nunca rompe el flujo.
 */
export async function photoFromUrl(url: string): Promise<string> {
  try {
    // los avatares de Google vienen como `...=s96-c`; pedimos más resolución
    const mejor = url.replace(/=s\d+-c$/, '=s256-c')
    const res = await fetch(mejor)
    if (!res.ok) return ''
    const blob = await res.blob()
    return await resizePhoto(new File([blob], 'avatar', { type: blob.type }))
  } catch {
    return ''
  }
}
