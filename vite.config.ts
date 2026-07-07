/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dominio propio: cuantomefalta.app (Cloudflare DNS → GitHub Pages).
// El sitio sirve desde la raíz, así que base es '/' (antes era '/cuanto-me-falta/').
// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  // El dominio (Plan/selectors/datos) es puro → corre en Node, sin DOM.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
