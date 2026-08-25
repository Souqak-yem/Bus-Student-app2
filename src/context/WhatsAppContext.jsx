import { createContext, useContext, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import {
  WHATSAPP_DEFAULT_KEY,
  WHATSAPP_OPTIONS,
  buildWhatsAppUrl,
  getDefaultWhatsAppApp,
  sanitizeWhatsAppNumber,
} from '../lib/whatsapp'

const WhatsAppContext = createContext(null)

function launchWhatsApp(app, phone, message) {
  window.open(buildWhatsAppUrl(app, phone, message), '_blank', 'noopener,noreferrer')
}

export function WhatsAppProvider({ children }) {
  const [pending, setPending] = useState(null)

  function openWhatsApp(phoneValue, message = '') {
    const phone = sanitizeWhatsAppNumber(phoneValue)
    if (!phone) return false
    const defaultApp = getDefaultWhatsAppApp()
    if (defaultApp) {
      launchWhatsApp(defaultApp, phone, message)
      return true
    }
    setPending({ phone, message })
    return true
  }

  function chooseWhatsApp(app, remember) {
    if (!pending) return
    if (remember) localStorage.setItem(WHATSAPP_DEFAULT_KEY, app)
    launchWhatsApp(app, pending.phone, pending.message)
    setPending(null)
  }

  return (
    <WhatsAppContext.Provider value={{ openWhatsApp }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="whatsapp-chooser-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600"><MessageCircle size={21} /></div>
                <div>
                  <h2 id="whatsapp-chooser-title" className="text-base font-bold text-slate-800">اختيار تطبيق واتساب</h2>
                  <p className="mt-1 text-xs text-slate-500">اختر التطبيق الذي تريد استخدامه</p>
                </div>
              </div>
              <button type="button" onClick={() => setPending(null)} className="text-slate-400 hover:text-slate-700" aria-label="إغلاق"><X size={19} /></button>
            </div>
            <div className="space-y-2">
              {Object.entries(WHATSAPP_OPTIONS).map(([app, option]) => (
                <button key={app} type="button" onClick={() => chooseWhatsApp(app, false)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-right transition-colors hover:border-green-400 hover:bg-green-50">
                  <span><span className="block text-sm font-semibold text-slate-800">{option.label}</span><span className="mt-1 block text-xs text-slate-500">{option.description}</span></span>
                  <MessageCircle size={18} className="text-green-600" />
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPending(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">إلغاء</button>
              <button type="button" onClick={() => chooseWhatsApp(pending.selected || 'chooser', true)} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">دائماً: اختيار التطبيق</button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">للحفظ دائماً، اختر التطبيق ثم استخدم زر الحفظ أدناه</p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {Object.entries(WHATSAPP_OPTIONS).map(([app, option]) => <button key={app} type="button" onClick={() => chooseWhatsApp(app, true)} className="rounded-lg border border-green-200 px-2 py-2 text-[11px] font-medium text-green-700 hover:bg-green-50">دائماً<br />{option.label}</button>)}
            </div>
          </div>
        </div>
      )}
    </WhatsAppContext.Provider>
  )
}

export function useWhatsAppRedirect() {
  const context = useContext(WhatsAppContext)
  if (!context) throw new Error('useWhatsAppRedirect must be used inside WhatsAppProvider')
  return context.openWhatsApp
}