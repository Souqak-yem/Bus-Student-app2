export function sanitizeWhatsAppNumber(value) {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `966${digits.slice(1)}`
  return digits
}

export function buildWhatsAppUrl(phone, message = '') {
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}