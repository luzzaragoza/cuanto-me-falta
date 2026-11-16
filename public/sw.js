// Service worker mínimo: deja la app "instalable" y con un offline básico.
// Estrategia deliberada:
//   - Navegación (HTML): RED PRIMERO → nunca quedás clavado en una versión vieja.
//   - Assets hasheados de Vite: CACHE PRIMERO → carga instantánea y offline.
//
// El nombre del caché se sube cuando cambia algo que NO lleva hash en el nombre: los
// íconos, el favicon y la imagen de compartir se sirven "caché primero", así que con el
// mismo nombre un dispositivo que ya los tiene no los vuelve a pedir nunca. v2 = el
// ícono nuevo (16-nov): al activarse, el worker borra el caché viejo entero.
const CACHE = 'cmf-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return

  // HTML: red primero, cache de respaldo.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./'))),
    )
    return
  }

  // Assets: cache primero, red de respaldo (y guarda para la próxima).
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
