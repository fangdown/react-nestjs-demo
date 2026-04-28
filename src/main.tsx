import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'
import App from './App.tsx'

/** 与 Vite `base`（import.meta.env.BASE_URL）一致，供挂到主站子路径时使用 */
function routerBasename(): string | undefined {
  const baseUrl = import.meta.env.BASE_URL
  if (baseUrl === '/') return undefined
  const b = baseUrl.replace(/\/$/, '')
  return b === '' ? undefined : b
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
