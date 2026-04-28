import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** 本地 `npm run dev` 默认与线上一致；若要在根路径开发，在 `.env` 中设 `VITE_PUBLIC_BASE_PATH=/` */
const DEV_DEFAULT_BASE = '/nestjs-reading/'

function normalizeBase(raw: string): string {
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

function resolveBase(mode: string, env: Record<string, string>): string {
  const explicit = env.VITE_PUBLIC_BASE_PATH?.trim()
  if (explicit === '/') {
    return '/'
  }
  if (explicit) {
    return normalizeBase(explicit)
  }
  if (mode === 'development') {
    return DEV_DEFAULT_BASE
  }
  return '/'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = resolveBase(mode, env)

  return {
    base,
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
