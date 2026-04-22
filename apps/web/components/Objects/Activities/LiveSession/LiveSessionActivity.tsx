'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { CalendarDays, Clock3, MessageSquareText, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getLiveSessionLaunchConfig } from '@services/courses/activities'
import { useContributorStatus } from '@/hooks/useContributorStatus'
import {
  formatLiveSessionDate,
  isLiveSessionDetails,
} from './liveSessionUtils'

const jitsiScriptPromises = new Map<string, Promise<void>>()

function loadJitsiScript(scriptUrl: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  if ((window as any).JitsiMeetExternalAPI) {
    return Promise.resolve()
  }

  const existingScript = document.querySelector(
    `script[data-jitsi-script="${scriptUrl}"]`
  ) as HTMLScriptElement | null

  if (existingScript && jitsiScriptPromises.has(scriptUrl)) {
    return jitsiScriptPromises.get(scriptUrl)!
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = existingScript || document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.dataset.jitsiScript = scriptUrl
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error(`Failed to load Jitsi script from ${scriptUrl}`))

    if (!existingScript) {
      document.body.appendChild(script)
    }
  })

  jitsiScriptPromises.set(scriptUrl, promise)
  return promise
}

function JitsiRoom({
  launchConfig,
  language,
}: {
  launchConfig: Awaited<ReturnType<typeof getLiveSessionLaunchConfig>>
  language: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<any>(null)

  useEffect(() => {
    let disposed = false

    async function mountConference() {
      await loadJitsiScript(launchConfig.script_url)

      if (disposed || !containerRef.current || !(window as any).JitsiMeetExternalAPI) {
        return
      }

      if (apiRef.current) {
        apiRef.current.dispose?.()
      }

      apiRef.current = new (window as any).JitsiMeetExternalAPI(launchConfig.domain, {
        roomName: launchConfig.room_name,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        jwt: launchConfig.jwt || undefined,
        lang: language.split('-')[0],
        userInfo: {
          displayName: launchConfig.display_name || undefined,
          email: launchConfig.email || undefined,
        },
        configOverwrite: {
          prejoinPageEnabled: true,
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
        },
      })
    }

    mountConference().catch((error) => {
      console.error('Failed to initialize live session', error)
    })

    return () => {
      disposed = true
      apiRef.current?.dispose?.()
      apiRef.current = null
    }
  }, [launchConfig, language])

  return (
    <div
      ref={containerRef}
      className="min-h-[560px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      style={{ height: '72vh' }}
    />
  )
}

export default function LiveSessionActivity({
  activity,
  course,
}: {
  activity: any
  course: any
}) {
  const { t, i18n } = useTranslation()
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus()
  const courseUuid = course?.course_uuid?.replace('course_', '') || ''
  const { contributorStatus } = useContributorStatus(courseUuid)
  const [now, setNow] = useState(() => Date.now())
  const [shouldJoin, setShouldJoin] = useState(false)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(interval)
  }, [])

  const details = isLiveSessionDetails(activity?.details) ? activity.details : null

  const scheduledStart = useMemo(() => {
    if (!details?.scheduled_start) return null
    const date = new Date(details.scheduled_start)
    return Number.isNaN(date.getTime()) ? null : date
  }, [details?.scheduled_start])

  const canManageSession = Boolean(isAdmin) || contributorStatus === 'ACTIVE'
  const canJoin = !scheduledStart || now >= scheduledStart.getTime() || canManageSession
  const locale = i18n.resolvedLanguage || i18n.language || 'es'

  const { data: launchConfig, error, isLoading } = useSWR(
    shouldJoin ? ['live-session-launch', activity.activity_uuid, accessToken] : null,
    () => getLiveSessionLaunchConfig(activity.activity_uuid, accessToken)
  )

  if (!details) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {t('activities.live_session_missing', {
          defaultValue: 'This live session is missing its configuration.',
        })}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {!shouldJoin && (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                <Video size={14} />
                {t('activities.live_session', { defaultValue: 'Live Session' })}
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">{activity.name}</h2>
              {details.description ? (
                <p className="max-w-2xl text-sm leading-6 text-gray-600">
                  {details.description}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-500" />
                <span className="font-medium text-gray-800">
                  {scheduledStart
                    ? formatLiveSessionDate(details.scheduled_start, locale)
                    : t('activities.live_session_starts_now', {
                        defaultValue: 'Available now',
                      })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Clock3 size={16} className="text-gray-500" />
                <span>
                  {t('activities.live_session_duration_label', {
                    defaultValue: '{{count}} minutes',
                    count: details.duration_minutes,
                  })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <MessageSquareText size={16} className="text-gray-500" />
                <span>
                  {t('activities.live_session_chat_label', {
                    defaultValue: 'Chat and screen sharing are available inside the room.',
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {!canJoin ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {t('activities.live_session_waiting', {
                  defaultValue:
                    'This classroom opens at the scheduled time. Come back when the session starts.',
                })}
              </div>
            ) : canManageSession && scheduledStart && now < scheduledStart.getTime() ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {t('activities.live_session_early_access', {
                  defaultValue:
                    'You can open the classroom before the scheduled start because you manage this course.',
                })}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!canJoin}
              onClick={() => setShouldJoin(true)}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                canJoin
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'cursor-not-allowed bg-gray-200 text-gray-500'
              }`}
            >
              <Video size={16} />
              {canManageSession && scheduledStart && now < scheduledStart.getTime()
                ? t('activities.open_live_session', {
                    defaultValue: 'Open classroom now',
                  })
                : t('activities.enter_live_session', {
                    defaultValue: 'Enter live session',
                  })}
            </button>
          </div>
        </div>
      )}

      {shouldJoin ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{activity.name}</h3>
              <p className="text-sm text-gray-500">
                {t('activities.live_session_inside', {
                  defaultValue: 'You are inside the live classroom.',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShouldJoin(false)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('activities.leave_live_session_preview', {
                defaultValue: 'Close room',
              })}
            </button>
          </div>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
            </div>
          ) : error || !launchConfig ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {t('activities.live_session_launch_error', {
                defaultValue: 'The live room could not be opened right now.',
              })}
            </div>
          ) : (
            <JitsiRoom launchConfig={launchConfig} language={locale} />
          )}
        </div>
      ) : null}
    </div>
  )
}
