import { StrictMode, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import AppSplashScreen from './components/AppSplashScreen'
import App from './App.jsx'
import { applyDisplaySettings, getDisplaySettings } from './lib/displaySettings'
import './index.css'

const APP_VERSION = __APP_VERSION__ || 'dev'

async function clearStaleServiceWorkerState() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((reg) => reg.unregister()))
    const cacheKeys = await caches.keys()
    await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    localStorage.setItem('mashawerk_app_version', APP_VERSION)
  } catch (error) {
    console.warn('[App] Failed to clear stale SW/cache state:', error)
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const isDev = import.meta.env.DEV
    const shouldRegister = !isDev && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const lastSeenVersion = localStorage.getItem('mashawerk_app_version')

    if (lastSeenVersion && lastSeenVersion !== APP_VERSION) {
      console.warn('[App] App version changed from', lastSeenVersion, 'to', APP_VERSION, '— clearing stale cache and SW')
      await clearStaleServiceWorkerState()
      window.location.reload()
      return
    }

    if (!shouldRegister) {
      // In development (or when not on a supported origin) never let the
      // service worker intercept requests. A stale SW from a previous session
      // can otherwise hijack navigation and return the offline 503 fallback.
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
      } catch (error) {
        console.warn('[App] Unable to unregister SW in unsupported origin:', error)
      }
      localStorage.setItem('mashawerk_app_version', APP_VERSION)
      return
    }

    try {
      const reg = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(APP_VERSION)}`, {
        scope: '/',
        updateViaCache: 'none',
      })
      console.log('[App] SW registered, scope:', reg.scope)
      localStorage.setItem('mashawerk_app_version', APP_VERSION)
      await reg.update().catch((error) => {
        console.warn('[App] SW update check failed:', error)
      })

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
    } catch (error) {
      console.error('[App] SW registration failed:', error)
    }

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

  if (!document.documentElement.dataset.theme) {
    applyDisplaySettings(getDisplaySettings())
  }

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
