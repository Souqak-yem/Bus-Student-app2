const DISPLAY_SETTINGS_KEY = 'studentDisplaySettings'
const DEFAULT_FONT_SIZE = 'normal'
const DEFAULT_COLOR = '#2563EB'

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const num = Number.parseInt(full, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

function mixColor(hex, targetHex, weight) {
  const base = hexToRgb(hex)
  const target = hexToRgb(targetHex)
  const mix = (start, end) => Math.round(start + (end - start) * weight)
  const toHex = (value) => value.toString(16).padStart(2, '0')
  return `#${toHex(mix(base.r, target.r))}${toHex(mix(base.g, target.g))}${toHex(mix(base.b, target.b))}`
}

const FONT_SIZE_OPTIONS = {
  small: '14px',
  normal: '16px',
  large: '18px',
}

export function getDisplaySettings() {
  try {
    const saved = localStorage.getItem(DISPLAY_SETTINGS_KEY)
    const parsed = saved ? JSON.parse(saved) : {}
    return {
      theme: parsed.theme || 'light',
      fontSize: parsed.fontSize || DEFAULT_FONT_SIZE,
      appColor: parsed.appColor || DEFAULT_COLOR,
    }
  } catch {
    return {
      theme: 'light',
      fontSize: DEFAULT_FONT_SIZE,
      appColor: DEFAULT_COLOR,
    }
  }
}

export function applyDisplaySettings(settings = getDisplaySettings()) {
  const root = document.documentElement
  const theme = settings.theme || 'light'
  const fontSize = settings.fontSize || DEFAULT_FONT_SIZE
  const appColor = settings.appColor || DEFAULT_COLOR

  root.dataset.theme = theme
  root.style.fontSize = FONT_SIZE_OPTIONS[fontSize] || '16px'
  root.style.setProperty('--color-primary', appColor)
  root.style.setProperty('--color-primary-dark', mixColor(appColor, '#0F172A', 0.7))
  root.style.setProperty('--color-primary-light', mixColor(appColor, '#FFFFFF', 0.45))
  root.style.setProperty('--color-primary-lighter', mixColor(appColor, '#FFFFFF', 0.8))

  return { theme, fontSize, appColor }
}

export function saveDisplaySettings({ theme = 'light', fontSize = DEFAULT_FONT_SIZE, appColor = DEFAULT_COLOR }) {
  const settings = { theme, fontSize, appColor }
  localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings))
  return applyDisplaySettings(settings)
}

export function resetDisplaySettings() {
  const settings = { theme: 'light', fontSize: DEFAULT_FONT_SIZE, appColor: DEFAULT_COLOR }
  localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings))
  return applyDisplaySettings(settings)
}

export { DISPLAY_SETTINGS_KEY, DEFAULT_COLOR, DEFAULT_FONT_SIZE, FONT_SIZE_OPTIONS }
