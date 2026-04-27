'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { CalendarDays, ChevronRight, Clock, UserRound } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg } from '@services/config/config'
import { getScheduleSummary, ScheduleSummary } from '@services/schedule/schedule'

type ScheduleHomeCardProps = {
  orgId: number
  orgslug: string
  compact?: boolean
}

function formatSessionDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function ScheduleHomeCard({ orgId, orgslug, compact = false }: ScheduleHomeCardProps) {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const isAuthenticated = session?.status === 'authenticated'

  const { data } = useSWR<ScheduleSummary>(
    isAuthenticated && token && orgId ? ['schedule-summary', orgId, token] : null,
    () => getScheduleSummary(orgId, token),
    { revalidateOnFocus: false }
  )

  if (!isAuthenticated) return null

  const nextSession = data?.upcoming_sessions?.[0]
  const hasTutor = Boolean(data?.assigned_tutors?.length)
  const isStaff = Boolean(data?.is_admin || data?.is_tutor)

  return (
    <section className={compact ? '' : 'mb-6'}>
      <Link
        href={getUriWithOrg(orgslug, '/schedule')}
        className="group block rounded-lg border border-gray-200 bg-white p-4 nice-shadow transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
              <CalendarDays size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  {isStaff ? 'Agenda' : 'Agendar tutoría'}
                </h2>
                {data?.notifications?.some((item) => !item.read_at) && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                    Nuevo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {isStaff
                  ? 'Revisa reservas, alumnos y disponibilidad desde tu calendario.'
                  : hasTutor
                    ? `Tienes ${data?.assigned_tutors.length} tutor${data?.assigned_tutors.length === 1 ? '' : 'es'} disponible${data?.assigned_tutors.length === 1 ? '' : 's'} para reservar.`
                    : 'Este recurso ya está listo. Un administrador debe asignarte un tutor para reservar.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {nextSession ? (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <Clock size={15} />
                <span>{formatSessionDate(nextSession.starts_at)}</span>
              </div>
            ) : hasTutor ? (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <UserRound size={15} />
                <span>Reservar hora</span>
              </div>
            ) : null}
            <ChevronRight className="text-gray-400 transition-transform group-hover:translate-x-1" size={20} />
          </div>
        </div>
      </Link>
    </section>
  )
}
