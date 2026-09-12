import type { ComercioThemeMode } from '@/hooks/useComercioTheme'

export interface ComercioTheme {
  pageBg: string
  cardBg: string
  cardBorder: string
  textPrimary: string
  textMuted: string
  textFaint: string
  accent: string
  accentTint: (alpha: number) => string
  imagePlate: string
  inputBg: string
  inputBorder: string
  buttonBg: string
  buttonBorder: string
  buttonText: string
  buttonAddedBg: string
  glowOpacity: number
  /** Verde — señal de "estás ahorrando" (descuento, precio final con rebaja). */
  savings: string
  savingsTint: (alpha: number) => string
  /** Naranja/rojo — señal de urgencia (poco stock). */
  urgency: string
  urgencyTint: (alpha: number) => string
}

const DARK: ComercioTheme = {
  pageBg: '#0D1B2A',
  cardBg: '#132845',
  cardBorder: 'rgba(91,157,249,0.14)',
  textPrimary: '#EFF3F8',
  textMuted: 'rgba(244,246,242,0.6)',
  textFaint: 'rgba(244,246,242,0.4)',
  accent: '#5B9DF9',
  accentTint: (a: number) => `rgba(91,157,249,${a})`,
  imagePlate: '#F4F1E7',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
  buttonBg: '#FFFFFF',
  buttonBorder: '#FFFFFF',
  buttonText: '#0D1B2A',
  buttonAddedBg: 'rgba(91,157,249,0.15)',
  glowOpacity: 1,
  savings: '#34D399',
  savingsTint: (a: number) => `rgba(52,211,153,${a})`,
  urgency: '#FF7A50',
  urgencyTint: (a: number) => `rgba(255,122,80,${a})`,
}

// Fondo claro: el contraste lo dan los bordes y el texto en azul, no rellenos oscuros.
const LIGHT: ComercioTheme = {
  pageBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: '#2F6FE0',
  textPrimary: '#0D1B2A',
  textMuted: 'rgba(13,27,42,0.6)',
  textFaint: 'rgba(13,27,42,0.42)',
  accent: '#2F6FE0',
  accentTint: (a: number) => `rgba(47,111,224,${a})`,
  imagePlate: '#F4F1E7',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(47,111,224,0.4)',
  buttonBg: '#FFFFFF',
  buttonBorder: '#2F6FE0',
  buttonText: '#2F6FE0',
  buttonAddedBg: 'rgba(47,111,224,0.08)',
  glowOpacity: 0,
  savings: '#0E9F6E',
  savingsTint: (a: number) => `rgba(14,159,110,${a})`,
  urgency: '#D6472A',
  urgencyTint: (a: number) => `rgba(214,71,42,${a})`,
}

export function getComercioTheme(mode: ComercioThemeMode): ComercioTheme {
  return mode === 'dark' ? DARK : LIGHT
}

// Escala roja -> naranja -> verde para diferenciar visualmente los tramos de
// descuento (tramo bajo = rojo, tramo alto = verde), usada en la matriz de
// cantidad/descuento y en la barra de ahorro.
type RGB = [number, number, number]
const ESCALA_ROJO: RGB = [214, 71, 42]
const ESCALA_NARANJA: RGB = [235, 130, 43]
const ESCALA_VERDE: RGB = [22, 197, 94]

function mezclarRGB(a: RGB, b: RGB, t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

/** t en [0,1]: 0 = rojo (peor tramo), 0.5 = naranja, 1 = verde (mejor tramo). */
export function getTramoScaleColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  if (clamped <= 0.5) return mezclarRGB(ESCALA_ROJO, ESCALA_NARANJA, clamped / 0.5)
  return mezclarRGB(ESCALA_NARANJA, ESCALA_VERDE, (clamped - 0.5) / 0.5)
}
