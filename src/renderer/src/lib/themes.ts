import type { ThemeName } from './types'
import type { TranslationKey } from './i18n'

export interface ThemeColors {
  accent: string
  accent2: string
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  violetAmber: { accent: '#7c5cff', accent2: '#f0a900' },
  blueOrange: { accent: '#2f6fe0', accent2: '#ff7a33' },
  pinkLime: { accent: '#e0459a', accent2: '#6dd45a' },
  tealCoral: { accent: '#1fa3a3', accent2: '#ff6b5e' },
  crimsonGold: { accent: '#d1435b', accent2: '#f0b429' },
  emeraldViolet: { accent: '#1fa876', accent2: '#9b5de5' },
  indigoPeach: { accent: '#5865f2', accent2: '#ff9a76' },
  slateAmber: { accent: '#586b8c', accent2: '#e0a527' }
}

export const THEME_LABEL_KEYS: Record<ThemeName, TranslationKey> = {
  violetAmber: 'theme.violetAmber',
  blueOrange: 'theme.blueOrange',
  pinkLime: 'theme.pinkLime',
  tealCoral: 'theme.tealCoral',
  crimsonGold: 'theme.crimsonGold',
  emeraldViolet: 'theme.emeraldViolet',
  indigoPeach: 'theme.indigoPeach',
  slateAmber: 'theme.slateAmber'
}
