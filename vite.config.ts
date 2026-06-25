import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages sirve el proyecto en https://luzzaragoza.github.io/cuanto-me-falta/
// por eso el base tiene que ser el nombre del repo (en dev queda en '/').
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/cuanto-me-falta/' : '/',
  plugins: [react()],
}))
