import { StrictMode, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import AppSplashScreen from './components/AppSplashScreen'
import App from './App.jsx'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isDev = import.meta.env.DEV
    const shouldRegister = !isDev && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

    if (!shouldRegister) {
      // In development (or when not on a supported origin) never let the
      // service worker intercept requests. A stale SW from a previous session
      // can otherwise hijack navigation and return the offline 503 fallback.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
      })
      return
    }

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      console.log('[App] SW registered, scope:', reg.scope)

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[App] SW state:', newWorker.state)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              const event = new CustomEvent('sw-update-available')
              window.dispatchEvent(event)
            }
          })
        }
      })

      setInterval(() => {
        reg.update().catch(() => {})
      }, 60 * 60 * 1000)

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {})
        }
      })
    }).catch((error) => {
      console.error('[App] SW registration failed:', error)
    })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[App] New SW took control, reloading...')
      window.location.reload()
    })
  })
}

function Root() {
  const [showSplash, setShowSplash] = useState(() => {
    const val = sessionStorage.getItem('mashawerk_session_splash')
    return val !== 'true'
  })

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false)
  }, [])

  if (showSplash) {
    return <AppSplashScreen onFinish={handleSplashFinish} />
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
