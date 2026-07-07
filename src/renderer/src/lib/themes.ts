import type { ThemeName } from './types'

export interface ThemeColors {
  label: string
  accent: string
  accent2: string
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  violetAmber: { label: 'Фиолетовый + Янтарный', accent: '#7c5cff', accent2: '#f0a900' },
  blueOrange: { label: 'Синий + Оранжевый', accent: '#2f6fe0', accent2: '#ff7a33' },
  pinkLime: { label: 'Розовый + Салатовый', accent: '#e0459a', accent2: '#6dd45a' },
  tealCoral: { label: 'Бирюзовый + Коралловый', accent: '#1fa3a3', accent2: '#ff6b5e' }
}
