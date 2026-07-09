import { useLanguageStore } from '../../state/useLanguageStore'
import { translate, type TranslationKey } from './index'

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string

export function useT(): TFunction {
  const language = useLanguageStore((s) => s.language)
  return (key, vars) => translate(language, key, vars)
}
