const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const currencySymbol = '﷼'

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return numberFormatter.format(number)
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  if (Number.isNaN(number)) return String(value)
  return `${formatNumber(number)} ${currencySymbol}`
}

export default { formatNumber, formatCurrency }
