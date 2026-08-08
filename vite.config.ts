/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

/**
 * Versión visible en la app: fecha del último commit + su hash corto (calendario, no
 * semver — esto se despliega de continuo y lo que importa es "¿tengo la última?",
 * sobre todo con la PWA, que puede quedar cacheada). Se resuelve en tiempo de build y
 * viaja como constante; si no hay git (tarball, sandbox), cae a la fecha de hoy.
 */
function versionApp(): string {
  const git = (cmd: string): string => {
    try {
      return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      return ''
    }
  }
  const sha = git('git rev-parse --short=7 HEAD') || (process.env.GITHUB_SHA ?? '').slice(0, 7)
  const fecha =
    git('git log -1 --format=%cd --date=format:%Y.%m.%d') ||
    new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  return sha ? `${fecha}·${sha}` : fecha
}

// Dominio propio: cuantomefalta.app (Cloudflare DNS → GitHub Pages).
// El sitio sirve desde la raíz, así que base es '/' (antes era '/cuanto-me-falta/').
// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(versionApp()) },
  // El dominio (Plan/selectors/datos) es puro → corre en Node, sin DOM.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
