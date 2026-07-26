import { useState, useEffect } from 'react'

function Row({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-sm text-slate-800 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value ?? '...'}</span>
    </div>
  )
}

async function getSwInfo() {
  if (!('serviceWorker' in navigator)) {
    return {
      registered: 'No (API not supported)',
      state: '-',
      scriptURL: '-',
      controller: 'No',
      cacheVersion: '-',
      lastUpdate: '-',
    }
  }

  const reg = await navigator.serviceWorker.getRegistration()
  const controller = navigator.serviceWorker.controller

  if (!reg) {
    return {
      registered: 'No (no registration)',
      state: '-',
      scriptURL: '-',
      controller: controller ? 'Yes' : 'No',
      cacheVersion: '-',
      lastUpdate: '-',
    }
  }

  const sw = reg.active || reg.waiting || reg.installing
  const state = sw?.state || 'unknown'
  const scriptURL = sw?.scriptURL || reg.scope || '-'

  let cacheVersion = '-'
  try {
    const cacheNames = await caches.keys()
    const activeCache = cacheNames.find((c) => c.startsWith('mashawerk-'))
    cacheVersion = activeCache || cacheNames.join(', ') || '(none)'
  } catch { cacheVersion = '(error reading caches)' }

  let lastUpdate = '-'
  try {
    const res = await fetch('/sw.js', { cache: 'no-store' })
    const headers = res.headers
    const date = headers.get('last-modified') || headers.get('date')
    if (date) lastUpdate = new Date(date).toLocaleString('ar-SA')
  } catch { lastUpdate = '(fetch failed)' }

  return {
    registered: 'Yes',
    state,
    scriptURL,
    controller: controller ? 'Yes' : 'No',
    cacheVersion,
    lastUpdate,
  }
}

function getDisplayMode() {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return 'standalone (PWA)'
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return 'fullscreen'
  if (window.matchMedia?.('(display-mode: minimal-ui)').matches) return 'minimal-ui'
  return 'browser'
}

export default function Debug() {
  const [swInfo, setSwInfo] = useState(null)
  const [now, setNow] = useState(() => new Date().toLocaleString('ar-SA'))

  useEffect(() => {
    getSwInfo().then(setSwInfo)
    const t = setInterval(() => setNow(new Date().toLocaleString('ar-SA')), 1000)
    return () => clearInterval(t)
  }, [])

  const info = [
    { label: 'App Version', value: __APP_VERSION__ },
    { label: 'Build Hash', value: __BUILD_HASH__, mono: true },
    { label: 'Build Time', value: __BUILD_TIME__ },
    { label: 'Current Time', value: now },
    { label: 'SW Registered?', value: swInfo?.registered },
    { label: 'SW State', value: swInfo?.state },
    { label: 'SW Script URL', value: swInfo?.scriptURL, mono: true },
    { label: 'SW Controller', value: swInfo?.controller },
    { label: 'Cache Version', value: swInfo?.cacheVersion, mono: true },
    { label: 'SW Last Update', value: swInfo?.lastUpdate },
    { label: 'Display Mode', value: getDisplayMode() },
    { label: 'User Agent', value: navigator.userAgent },
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-lg mx-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h1 className="text-lg font-bold text-slate-800 mb-4">Debug Info</h1>
        {info.map((item) => (
          <Row key={item.label} label={item.label} value={item.value} mono={item.mono} />
        ))}
      </div>
      <button
        onClick={() => navigator.clipboard?.writeText(
          info.map((i) => `${i.label}: ${i.value}`).join('\n')
        )}
        className="w-full mt-3 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
      >
        نسخ كل المعلومات
      </button>
    </div>
  )
}
