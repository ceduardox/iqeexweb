export interface Language {
  code: string
  translationKey: string
  nativeName: string
}

export const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'es', translationKey: 'common.spanish', nativeName: 'Espa\u00f1ol' },
  { code: 'en', translationKey: 'common.english', nativeName: 'English' },
  { code: 'fr', translationKey: 'common.french', nativeName: 'Fran\u00e7ais' },
  { code: 'de', translationKey: 'common.german', nativeName: 'Deutsch' },
  { code: 'pt', translationKey: 'common.portuguese', nativeName: 'Portugu\u00eas' },
  { code: 'it', translationKey: 'common.italian', nativeName: 'Italiano' },
  { code: 'nl', translationKey: 'common.dutch', nativeName: 'Nederlands' },
  { code: 'pl', translationKey: 'common.polish', nativeName: 'Polski' },
  { code: 'tr', translationKey: 'common.turkish', nativeName: 'T\u00fcrk\u00e7e' },
  { code: 'vi', translationKey: 'common.vietnamese', nativeName: 'Ti\u1ebfng Vi\u1ec7t' },
  { code: 'id', translationKey: 'common.indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ru', translationKey: 'common.russian', nativeName: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'ar', translationKey: 'common.arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
  { code: 'hi', translationKey: 'common.hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'bn', translationKey: 'common.bengali', nativeName: '\u09ac\u09be\u0982\u09b2\u09be' },
  { code: 'th', translationKey: 'common.thai', nativeName: '\u0e44\u0e17\u0e22' },
  { code: 'ja', translationKey: 'common.japanese', nativeName: '\u65e5\u672c\u8a9e' },
  { code: 'ko', translationKey: 'common.korean', nativeName: '\ud55c\uad6d\uc5b4' },
  { code: 'zh', translationKey: 'common.chinese', nativeName: '\u7b80\u4f53\u4e2d\u6587' },
]

const normalizeLanguageCode = (code: string): string =>
  code.toLowerCase().split('-')[0]

export const getLanguageByCode = (code: string): Language | undefined => {
  const normalizedCode = normalizeLanguageCode(code)
  return AVAILABLE_LANGUAGES.find((lang) => lang.code === normalizedCode)
}

export const getCurrentLanguageNativeName = (currentLang: string): string => {
  const language = getLanguageByCode(currentLang)
  return language?.nativeName || 'Espa\u00f1ol'
}
