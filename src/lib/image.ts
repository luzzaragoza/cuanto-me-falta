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
 * Baja una foto remota (p.ej. el avatar de Google al iniciar sesión) y la deja como
 * data URL de 256px para el perfil local. Usa `<img crossOrigin>` + canvas en vez de
 * `fetch` (los avatares de Google sirven CORS para imágenes, pero no siempre para
 * fetch). Devuelve '' si falla — la foto es opcional, nunca rompe el flujo.
 */
export function photoFromUrl(url: string, size = 256): Promise<string> {
  return new Promise((resolve) => {
    // los avatares de Google vienen como `...=s96-c`; pedimos más resolución
    const mejor = url.replace(/=s\d+-c$/, `=s${size}-c`)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve('')
        const min = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        resolve('') // canvas "tainted" u otro error: seguimos sin foto
      }
    }
    img.onerror = () => resolve('')
    img.src = mejor
  })
}
