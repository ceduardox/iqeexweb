'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '../locales/en.json'
import es from '../locales/es.json'

export const DEFAULT_LANGUAGE = 'es'

export const SUPPORTED_LANGUAGES = [
  'ar',
  'bn',
  'de',
  'en',
  'es',
  'fr',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'nl',
  'pl',
  'pt',
  'ru',
  'th',
  'tr',
  'vi',
  'zh',
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const LOCALE_LOADERS: Record<SupportedLanguage, () => Promise<{ default: any }>> = {
  ar: () => import('../locales/ar.json'),
  bn: () => import('../locales/bn.json'),
  de: () => import('../locales/de.json'),
  en: async () => ({ default: en }),
  es: async () => ({ default: es }),
  fr: () => import('../locales/fr.json'),
  hi: () => import('../locales/hi.json'),
  id: () => import('../locales/id.json'),
  it: () => import('../locales/it.json'),
  ja: () => import('../locales/ja.json'),
  ko: () => import('../locales/ko.json'),
  nl: () => import('../locales/nl.json'),
  pl: () => import('../locales/pl.json'),
  pt: () => import('../locales/pt.json'),
  ru: () => import('../locales/ru.json'),
  th: () => import('../locales/th.json'),
  tr: () => import('../locales/tr.json'),
  vi: () => import('../locales/vi.json'),
  zh: () => import('../locales/zh.json'),
}

const resources = {
  en: { common: en },
  es: { common: es },
}

const localeLoadPromises = new Map<SupportedLanguage, Promise<SupportedLanguage>>()

export function normalizeLanguageCode(lng?: string | null): SupportedLanguage {
  const candidate = (lng ?? DEFAULT_LANGUAGE).toLowerCase()
  const languageOnly = candidate.split('-')[0]

  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(languageOnly)) {
    return languageOnly as SupportedLanguage
  }

  return DEFAULT_LANGUAGE
}

function syncDocumentLanguage(lng?: string | null) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalizeLanguageCode(lng)
  }
}

function persistLanguagePreference(lng: SupportedLanguage) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('iqexLng', lng)
  }

  if (typeof document !== 'undefined') {
    document.cookie = `iqexLng=${lng}; path=/; max-age=31536000; SameSite=Lax`
  }
}

export async function ensureLocaleLoaded(
  lng?: string | null
): Promise<SupportedLanguage> {
  const normalized = normalizeLanguageCode(lng)

  if (i18n.hasResourceBundle(normalized, 'common')) {
    return normalized
  }

  const existingPromise = localeLoadPromises.get(normalized)
  if (existingPromise) {
    return existingPromise
  }

  const loadPromise: Promise<SupportedLanguage> = LOCALE_LOADERS[normalized]()
    .then((mod): SupportedLanguage => {
      i18n.addResourceBundle(normalized, 'common', mod.default, true, true)
      return normalized
    })
    .catch((error): SupportedLanguage => {
      console.warn(`Failed to load locale: ${normalized}`, error)
      return DEFAULT_LANGUAGE
    })
    .finally(() => {
      localeLoadPromises.delete(normalized)
    })

  localeLoadPromises.set(normalized, loadPromise)
  return loadPromise
}

export async function setAppLanguage(
  lng?: string | null
): Promise<SupportedLanguage> {
  const normalized = await ensureLocaleLoaded(lng)
  const currentLanguage = normalizeLanguageCode(
    i18n.resolvedLanguage || i18n.language
  )

  if (currentLanguage !== normalized) {
    await i18n.changeLanguage(normalized)
  } else {
    syncDocumentLanguage(normalized)
  }

  persistLanguagePreference(normalized)

  return normalized
}

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  load: 'languageOnly',
  lowerCaseLng: true,
  cleanCode: true,
  nonExplicitSupportedLngs: true,
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
  detection: {
    order: ['localStorage', 'cookie', 'querystring', 'path', 'subdomain'],
    caches: ['localStorage', 'cookie'],
    lookupLocalStorage: 'iqexLng',
    lookupCookie: 'iqexLng',
  },
  react: {
    useSuspense: false,
  },
})

async function initializeAppLanguage() {
  const normalized = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language)
  await ensureLocaleLoaded(normalized)

  if (normalizeLanguageCode(i18n.language) !== normalized) {
    await i18n.changeLanguage(normalized)
    persistLanguagePreference(normalized)
    return
  }

  syncDocumentLanguage(normalized)
  persistLanguagePreference(normalized)
}

void initializeAppLanguage()

i18n.on('languageChanged', (lng) => {
  const normalized = normalizeLanguageCode(lng)
  syncDocumentLanguage(normalized)
  void ensureLocaleLoaded(normalized)
})

export default i18n
