import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Puerto fijo 5173 (strictPort): es el origen permitido por defecto en el CORS
// del backend (OFFBALL_ORIGINS). Si el puerto está ocupado, Vite falla en vez de
// saltar a 5174 y provocar errores de CORS silenciosos.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET?.trim()
  const proxy = proxyTarget
    ? {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/health': { target: proxyTarget, changeOrigin: true },
      }
    : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: { host: 'localhost', port: 5173, strictPort: true, proxy },
    preview: { host: 'localhost', port: 5173, strictPort: true, proxy },
    build: { target: 'es2022', sourcemap: true },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  }
})
