export const WHATSAPP_DEFAULT_KEY = 'defaultWhatsAppApp'

export const WHATSAPP_OPTIONS = {
  regular: {
    label: 'واتساب العادي',
    description: 'فتح تطبيق واتساب المثبت على جهازك',
  },
  business: {
    label: 'واتساب الأعمال',
    description: 'فتح واتساب Business',
  },
  chooser: {
    label: 'اختيار التطبيق',
    description: 'استخدام منتقي التطبيقات في النظام',
  },
}

export function sanitizeWhatsAppNumber(value) {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `966${digits.slice(1)}`
  return digits
}

export function getDefaultWhatsAppApp() {
  try {
    const value = localStorage.getItem(WHATSAPP_DEFAULT_KEY)
    return value && WHATSAPP_OPTIONS[value] ? value : null
  } catch {
    return null
  }
}

export function resetDefaultWhatsAppApp() {
  localStorage.removeItem(WHATSAPP_DEFAULT_KEY)
}

export function buildWhatsAppUrl(app, phone, message = '') {
  const encodedMessage = message ? `&text=${encodeURIComponent(message)}` : ''
  if (app === 'regular') return `whatsapp://send?phone=${phone}${encodedMessage}`
  if (app === 'business') return `https://api.whatsapp.com/send?phone=${phone}${encodedMessage}`
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}