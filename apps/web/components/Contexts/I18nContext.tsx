'use client'

import React, { useEffect, useState } from 'react'
import i18n, { ensureLocaleLoaded } from '../../lib/i18n'

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    const syncLocale = async (lng?: string) => {
      setIsReady(false)
      await ensureLocaleLoaded(lng ?? i18n.resolvedLanguage ?? i18n.language)

      if (isMounted) {
        setIsReady(true)
      }
    }

    const handleInitialized = () => {
      void syncLocale()
    }

    const handleLanguageChanged = (lng: string) => {
      void syncLocale(lng)
    }

    if (i18n.isInitialized) {
      void syncLocale()
    } else {
      i18n.on('initialized', handleInitialized)
    }

    i18n.on('languageChanged', handleLanguageChanged)

    return () => {
      isMounted = false
      i18n.off('initialized', handleInitialized)
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [])

  if (!isReady) {
    return null
  }

  return <>{children}</>
}
