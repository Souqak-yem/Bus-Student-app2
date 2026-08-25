import { createContext, useContext } from 'react'
import { buildWhatsAppUrl, sanitizeWhatsAppNumber } from '../lib/whatsapp'

const WhatsAppContext = createContext(null)

export function WhatsAppProvider({ children }) {
  function openWhatsApp(phoneValue, message = '') {
    const phone = sanitizeWhatsAppNumber(phoneValue)
    if (!phone) return false
    window.open(buildWhatsAppUrl(phone, message), '_blank', 'noopener,noreferrer')
    return true
  }

  return (
    <WhatsAppContext.Provider value={{ openWhatsApp }}>
      {children}
    </WhatsAppContext.Provider>
  )
}

export function useWhatsAppRedirect() {
  const context = useContext(WhatsAppContext)
  if (!context) throw new Error('useWhatsAppRedirect must be used inside WhatsAppProvider')
  return context.openWhatsApp
}