export function getLocalDate(input = new Date()) {
  let d
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else {
    d = new Date(input)
  }
  d.setHours(0, 0, 0, 0)
  return d
}

export function getUtcDateRange(input = new Date()) {
  const d = new Date(input)
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
  return { start, end }
}

export function formatLocalDate(input = new Date()) {
  const d = getLocalDate(input)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(value) {
  if (!value) return null
  if (value instanceof Date) return getLocalDate(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    return getLocalDate(parsed)
  }
  return null
}

export function serializeLocalDate(value = new Date()) {
  const base = value instanceof Date ? value : parseLocalDate(value)
  if (!base) return null
  return formatLocalDate(base)
}

export function toDbDate(value = new Date()) {
  const base = value instanceof Date ? value : parseLocalDate(value)
  if (!base) return null
  const normalized = getLocalDate(base)
  return new Date(Date.UTC(normalized.getFullYear(), normalized.getMonth(), normalized.getDate(), 12))
}

export function toLocalDateKey(input = new Date()) {
  return formatLocalDate(input)
}

export function snapToSaturday(date) {
  const d = getLocalDate(date)
  const day = d.getDay()
  if (day === 6) return d
  const diff = day + 1
  d.setDate(d.getDate() - diff)
  return d
}

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const DAY_MAP = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 }
const CUTOFF_HOUR = 12

export function resolveExecutionDate(dayName, referenceDate = new Date()) {
  const today = getLocalDate(referenceDate)
  const currentDayIndex = today.getDay()
  const targetDayIndex = DAY_MAP[dayName]

  let diff = targetDayIndex - currentDayIndex
  if (diff < 0) diff += 7

  if (diff === 0 && referenceDate.getHours() >= CUTOFF_HOUR) {
    diff = 7
  }

  const date = new Date(today)
  date.setDate(date.getDate() + diff)
  return date
}

export function resolveDailyExecutionDates({ selectedDays, durationWeeks, referenceDate = new Date() }) {
  const sortedDays = [...new Set((selectedDays || []).filter(Boolean).map(d => String(d).toUpperCase()))]
    .sort((a, b) => DAY_MAP[a] - DAY_MAP[b])

  const dates = []
  for (let week = 0; week < durationWeeks; week++) {
    for (const day of sortedDays) {
      const base = resolveExecutionDate(day, referenceDate)
      const date = new Date(base)
      date.setDate(date.getDate() + week * 7)
      dates.push(date)
    }
  }

  dates.sort((a, b) => a - b)

  return {
    dates,
    startDate: dates.length > 0 ? dates[0] : null,
    endDate: dates.length > 0 ? dates[dates.length - 1] : null,
    weekCount: dates.length,
  }
}
