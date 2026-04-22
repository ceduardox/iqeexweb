export const DEFAULT_LIVE_SESSION_DURATION = 60

export interface LiveSessionDetails {
  type: 'live_session'
  provider: 'jitsi'
  description?: string
  room_name: string
  scheduled_start: string
  duration_minutes: number
  scheduled_timezone?: string
}

export interface LiveSessionFormValues {
  activityName: string
  description: string
  scheduledStart: string
  durationMinutes: number
}

export function isLiveSessionDetails(details: any): details is LiveSessionDetails {
  return Boolean(details && details.type === 'live_session' && details.room_name)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateTimeLocalValue(isoString?: string): string {
  const baseDate = isoString ? new Date(isoString) : new Date(Date.now() + 60 * 60 * 1000)
  if (Number.isNaN(baseDate.getTime())) {
    const fallback = new Date(Date.now() + 60 * 60 * 1000)
    return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}T${pad(fallback.getHours())}:${pad(fallback.getMinutes())}`
  }

  const localDate = new Date(baseDate.getTime() - baseDate.getTimezoneOffset() * 60 * 1000)
  return `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`
}

export function generateLiveSessionRoomName(activityName: string): string {
  const safeBase = activityName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'live-session'

  const randomSuffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)

  return `${safeBase}-${randomSuffix}`
}

export function buildLiveSessionDetails(
  values: LiveSessionFormValues,
  existingDetails?: any
): LiveSessionDetails {
  const roomName =
    isLiveSessionDetails(existingDetails) && existingDetails.room_name
      ? existingDetails.room_name
      : generateLiveSessionRoomName(values.activityName)

  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC'

  return {
    type: 'live_session',
    provider: 'jitsi',
    description: values.description.trim(),
    room_name: roomName,
    scheduled_start: new Date(values.scheduledStart).toISOString(),
    duration_minutes: Math.max(15, values.durationMinutes || DEFAULT_LIVE_SESSION_DURATION),
    scheduled_timezone: timezone,
  }
}

export function formatLiveSessionDate(dateValue: string, locale: string): string {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}
