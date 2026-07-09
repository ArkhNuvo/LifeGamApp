import ru, { type TranslationKey } from './ru'
import en from './en'
import pl from './pl'
import hu from './hu'
import isv from './isv'

export type { TranslationKey } from './ru'

export type LanguageCode = 'ru' | 'en' | 'pl' | 'hu' | 'isv'

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  ru: 'Русский',
  en: 'English',
  pl: 'Polski',
  hu: 'Magyar',
  isv: 'Medžuslovjansky'
}

export const LANGUAGE_CODES: LanguageCode[] = ['ru', 'en', 'pl', 'hu', 'isv']

const dictionaries: Partial<Record<LanguageCode, Record<TranslationKey, string>>> = {
  ru,
  en,
  pl,
  hu,
  isv
}

export function translate(
  language: LanguageCode,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const dict = dictionaries[language] ?? ru
  let text = dict[key] ?? ru[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, String(value))
    }
  }
  return text
}
