import { useState, useEffect, useCallback } from 'react'
import { X, Download, Smartphone, Plus } from 'lucide-react'
import IOSInstallGuide from './IOSInstallGuide'

const ANDROID_SESSION_KEY = 'pwa_install_popup_seen'
const IOS_LOCAL_KEY = 'mashawerk_ios_install_seen'

function detectDevice() {
  const ua = navigator.userAgent.toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()

  const isIPhone = /iphone|ipad|ipod/.test(ua) || (platform === 'iphone') || (platform === 'ipad')
  const isAndroid = /android/.test(ua)

  if (isIPhone) return 'ios'
  if (isAndroid) return 'android'
  return 'desktop'
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true ||
    document.referrer?.includes('android-app://')
  )
}

export default function InstallPWAPopup() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [deviceType, setDeviceType] = useState('desktop')
  const [isInstalled, setIsInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [iosGuideTriggered, setIosGuideTriggered] = useState(false)

  const dismiss = useCallback(() => {
    setShow(false)
    setDismissed(true)
    if (deviceType === 'android') {
      sessionStorage.setItem(ANDROID_SESSION_KEY, '1')
    }
    if (deviceType === 'ios') {
      localStorage.setItem(IOS_LOCAL_KEY, '1')
    }
  }, [deviceType])

  const handleFinishIosGuide = useCallback(() => {
    localStorage.setItem(IOS_LOCAL_KEY, '1')
    setShow(false)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setShow(false)
      }
    } finally {
      setDeferredPrompt(null)
      setInstalling(false)
    }
  }, [deferredPrompt])

  const handleOpenIosGuide = useCallback(() => {
    setShowIosGuide(true)
    setIosGuideTriggered(true)
  }, [])

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true)
      return
    }

    const device = detectDevice()
    setDeviceType(device)

    if (device === 'android' && sessionStorage.getItem(ANDROID_SESSION_KEY)) return
    if (device === 'ios' && localStorage.getItem(IOS_LOCAL_KEY)) return
    if (device === 'desktop') return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const timer = setTimeout(() => {
      const stillNotSeen =
        (device === 'android' && !sessionStorage.getItem(ANDROID_SESSION_KEY)) ||
        (device === 'ios' && !localStorage.getItem(IOS_LOCAL_KEY))
      if (stillNotSeen) setShow(true)
    }, 3500)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      setIsInstalled(true)
      setShow(false)
      setShowIosGuide(false)
    }
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  if (isInstalled) return null

  return (
    <>
      {/* Android / Desktop popup */}
      {!iosGuideTriggered && show && !dismissed && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4"
          onClick={dismiss}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={dismiss}
              className="absolute top-3 left-3 w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors z-10"
            >
              <X size={14} className="text-slate-500" />
            </button>

            <div className="px-5 pt-5 pb-3 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center mb-3 shadow-lg shadow-slate-200/80">
                <img src="/full-logo.svg" alt="شعار التطبيق" className="w-10 h-10 object-contain" />
              </div>
              <h3 className="text-base font-bold text-slate-800">ثبّت تطبيق مواصلاتك</h3>
              <p className="text-xs text-slate-500 mt-1">سرعة أكبر، إشعارات فورية، وتجربة أفضل</p>
            </div>

            <div className="px-5 pb-5">
              {deviceType === 'android' && (
                <div className="space-y-3">
                  <button
                    onClick={handleInstall}
                    disabled={!deferredPrompt || installing}
                    className="w-full py-3 rounded-xl bg-gradient-to-l from-blue-600 to-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {installing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        جاري التثبيت...
                      </span>
                    ) : (
                      'تثبيت التطبيق'
                    )}
                  </button>
                  <button
                    onClick={dismiss}
                    className="w-full py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-all"
                  >
                    تثبيت لاحقاً
                  </button>
                </div>
              )}

              {deviceType === 'ios' && (
                <div className="space-y-3">
                  <button
                    onClick={handleOpenIosGuide}
                    className="w-full py-3 rounded-xl bg-gradient-to-l from-blue-600 to-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all active:scale-[0.98]"
                  >
                    عرض دليل التثبيت
                  </button>
                </div>
              )}

              {deviceType === 'desktop' && (
                <div className="text-center py-2">
                  <p className="text-xs text-slate-500">افتح هذا الموقع على هاتفك المحمول لتثبيت التطبيق</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* iOS Guide - bottom sheet with 4 steps */}
      <IOSInstallGuide
        open={showIosGuide}
        onClose={() => {
          setShowIosGuide(false)
          setIosGuideTriggered(false)
          dismiss()
        }}
        onFinished={handleFinishIosGuide}
      />
    </>
  )
}
