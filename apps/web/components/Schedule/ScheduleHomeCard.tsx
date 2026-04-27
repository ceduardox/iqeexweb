'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { CalendarDays, ChevronRight, Clock, UserRound, Sparkles } from 'lucide-react'
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
  const cardLabel = isStaff ? 'Agenda' : 'Agendar tutoria'
  const cardDescription = isStaff
    ? 'Revisa reservas, alumnos y disponibilidad desde tu calendario.'
    : hasTutor
      ? `Tienes ${data?.assigned_tutors.length} tutor${data?.assigned_tutors.length === 1 ? '' : 'es'} disponible${data?.assigned_tutors.length === 1 ? '' : 's'} para reservar.`
      : 'Este recurso ya esta listo. Un administrador debe asignarte un tutor para reservar.'

  return (
    <section className={compact ? '' : 'mb-6'}>
      <Link
        href={getUriWithOrg(orgslug, '/schedule')}
        className="group block overflow-hidden rounded-lg border border-indigo-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
      >
        <div className="h-1 bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-500" />
        <div className="relative p-4">
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gradient-to-br from-cyan-100/70 to-transparent" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-200">
                <CalendarDays size={23} />
                {!hasTutor && !isStaff && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white ring-2 ring-white">
                    <Sparkles size={11} />
                  </span>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-950">
                    {cardLabel}
                  </h2>
                  {data?.notifications?.some((item) => !item.read_at) && (
                    <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 ring-1 ring-cyan-100">
                      Nuevo
                    </span>
                  )}
                  {!hasTutor && !isStaff && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                      Pendiente
                    </span>
                  )}
                </div>
                <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600">
                  {cardDescription}
                </p>
              </div>
            </div>

            <div className="relative flex items-center justify-between gap-3 sm:justify-end">
              {nextSession ? (
                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                  <Clock size={15} />
                  <span>{formatSessionDate(nextSession.starts_at)}</span>
                </div>
              ) : hasTutor ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  <UserRound size={15} />
                  <span>Reservar hora</span>
                </div>
              ) : (
                <div className="hidden rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-100 sm:block">
                  Esperando asignacion
                </div>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 transition-all group-hover:translate-x-1 group-hover:bg-indigo-600 group-hover:text-white">
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}
