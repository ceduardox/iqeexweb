'use client'

import React, { useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import toast from 'react-hot-toast'
import {
  CalendarDays,
  Clock,
  UserRound,
  Bell,
  Check,
  X,
  Plus,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  cancelScheduleSession,
  createTutorAssignment,
  createScheduleSession,
  createTutorAvailability,
  getScheduleSessions,
  getScheduleSummary,
  getOrgUsersForSchedule,
  getTutorSlots,
  ScheduleSession,
  ScheduleSlot,
  ScheduleSummary,
  ScheduleUser,
} from '@services/schedule/schedule'

type ScheduleModuleProps = {
  orgId: number
  orgslug: string
  dashboard?: boolean
}

const dayLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

function nameOf(user?: ScheduleUser) {
  if (!user) return ''
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return full || `@${user.username}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function ScheduleModule({ orgId, dashboard = false }: ScheduleModuleProps) {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const currentUserId = session?.data?.user?.id
  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSlot | null>(null)
  const [note, setNote] = useState('')
  const [availability, setAvailability] = useState({
    weekday: 0,
    start_time: '09:00',
    end_time: '17:00',
    slot_minutes: 30,
  })
  const [assignment, setAssignment] = useState({ tutor_user_id: '', student_user_id: '' })

  const summaryKey = token && orgId ? ['schedule-summary', orgId, token] : null
  const sessionsKey = token && orgId ? ['schedule-sessions', orgId, token] : null

  const { data: summary } = useSWR<ScheduleSummary>(
    summaryKey,
    () => getScheduleSummary(orgId, token),
    { revalidateOnFocus: false }
  )
  const { data: sessions } = useSWR<ScheduleSession[]>(
    sessionsKey,
    () => getScheduleSessions(orgId, token),
    { revalidateOnFocus: false }
  )
  const { data: orgUsers } = useSWR<any>(
    summary?.is_admin && token && orgId ? ['schedule-org-users', orgId, token] : null,
    () => getOrgUsersForSchedule(orgId, token),
    { revalidateOnFocus: false }
  )

  const tutors = summary?.assigned_tutors || []
  const selectedTutor = tutors.find((item) => item.id === selectedTutorId) || tutors[0]
  const tutorIdForSlots = selectedTutor?.id || (summary?.is_tutor ? currentUserId : null)
  const fromDate = useMemo(() => isoDate(new Date()), [])

  const { data: slots } = useSWR<ScheduleSlot[]>(
    token && orgId && tutorIdForSlots ? ['schedule-slots', orgId, tutorIdForSlots, fromDate, token] : null,
    () => getTutorSlots(orgId, tutorIdForSlots, fromDate, token),
    { revalidateOnFocus: false }
  )

  const visibleSessions = sessions || summary?.upcoming_sessions || []
  const groupedSlots = useMemo(() => {
    const groups: Record<string, ScheduleSlot[]> = {}
    ;(slots || []).forEach((slot) => {
      const key = new Date(slot.starts_at).toISOString().slice(0, 10)
      groups[key] = [...(groups[key] || []), slot]
    })
    return groups
  }, [slots])

  async function refreshAll() {
    await mutate(summaryKey)
    await mutate(sessionsKey)
    if (tutorIdForSlots) {
      await mutate(['schedule-slots', orgId, tutorIdForSlots, fromDate, token])
    }
  }

  async function handleBook() {
    if (!selectedTutor || !selectedSlot) return
    try {
      await createScheduleSession(
        orgId,
        {
          tutor_user_id: selectedTutor.id,
          starts_at: selectedSlot.starts_at,
          ends_at: selectedSlot.ends_at,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          student_notes: note,
        },
        token
      )
      toast.success('Reserva creada')
      setSelectedSlot(null)
      setNote('')
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo reservar')
    }
  }

  async function handleCancel(item: ScheduleSession) {
    try {
      await cancelScheduleSession(orgId, item.session_uuid, 'Cancelado desde agenda', token)
      toast.success('Reserva cancelada')
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cancelar')
    }
  }

  async function handleAvailabilitySubmit(event: React.FormEvent) {
    event.preventDefault()
    try {
      await createTutorAvailability(
        orgId,
        {
          tutor_user_id: currentUserId,
          ...availability,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
        token
      )
      toast.success('Disponibilidad agregada')
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar disponibilidad')
    }
  }

  async function handleAssignmentSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!assignment.tutor_user_id || !assignment.student_user_id) return
    try {
      await createTutorAssignment(
        orgId,
        {
          tutor_user_id: Number(assignment.tutor_user_id),
          student_user_id: Number(assignment.student_user_id),
          active: true,
        },
        token
      )
      toast.success('Tutor asignado')
      setAssignment({ tutor_user_id: '', student_user_id: '' })
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo asignar tutor')
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center nice-shadow">
          <CalendarDays className="mx-auto mb-3 text-gray-400" size={36} />
          <h1 className="text-xl font-semibold text-gray-900">Agenda</h1>
          <p className="mt-2 text-sm text-gray-500">Inicia sesión para ver tus tutorías.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={dashboard ? 'h-full w-full bg-[#f8f8f8] px-6 py-8' : 'mx-auto w-full max-w-7xl px-4 py-8'}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
            <CalendarDays size={18} />
            Agenda
          </div>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {summary?.is_tutor || summary?.is_admin ? 'Calendario de tutorías' : 'Agendar tutoría'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {summary?.is_tutor || summary?.is_admin
              ? 'Gestiona reservas, alumnos y disponibilidad desde un solo lugar.'
              : 'Selecciona un tutor asignado y reserva una hora disponible.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-lg border border-gray-200 bg-white p-4 nice-shadow">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <UserRound size={17} />
              {summary?.is_tutor || summary?.is_admin ? 'Mi rol' : 'Mis tutores'}
            </h2>
            {tutors.length > 0 ? (
              <div className="space-y-2">
                {tutors.map((tutor) => (
                  <button
                    key={tutor.id}
                    onClick={() => setSelectedTutorId(tutor.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${
                      selectedTutor?.id === tutor.id
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{nameOf(tutor)}</div>
                    <div className={selectedTutor?.id === tutor.id ? 'text-xs text-white/70' : 'text-xs text-gray-500'}>
                      {tutor.email}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                {summary?.is_tutor || summary?.is_admin
                  ? 'Puedes revisar reservas y configurar disponibilidad.'
                  : 'Aún no tienes tutor asignado. El recurso está visible, pero un administrador debe asignarte un tutor para reservar.'}
              </div>
            )}
          </section>

          {(summary?.is_tutor || summary?.is_admin) && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 nice-shadow">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Clock size={17} />
                Disponibilidad
              </h2>
              <form onSubmit={handleAvailabilitySubmit} className="space-y-3">
                <select
                  value={availability.weekday}
                  onChange={(event) => setAvailability({ ...availability, weekday: Number(event.target.value) })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {dayLabels.map((label, index) => (
                    <option key={label} value={index}>{label}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={availability.start_time}
                    onChange={(event) => setAvailability({ ...availability, start_time: event.target.value })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={availability.end_time}
                    onChange={(event) => setAvailability({ ...availability, end_time: event.target.value })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
                  <Plus size={16} />
                  Agregar horario
                </button>
              </form>
            </section>
          )}

          {summary?.is_admin && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 nice-shadow">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <UserRound size={17} />
                Asignar tutor
              </h2>
              <form onSubmit={handleAssignmentSubmit} className="space-y-3">
                <select
                  value={assignment.tutor_user_id}
                  onChange={(event) => setAssignment({ ...assignment, tutor_user_id: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Tutor o profesor</option>
                  {(orgUsers?.items || []).map((item: any) => (
                    <option key={`tutor-${item.user.id}`} value={item.user.id}>
                      {nameOf(item.user)} · {item.role?.name}
                    </option>
                  ))}
                </select>
                <select
                  value={assignment.student_user_id}
                  onChange={(event) => setAssignment({ ...assignment, student_user_id: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Alumno</option>
                  {(orgUsers?.items || []).map((item: any) => (
                    <option key={`student-${item.user.id}`} value={item.user.id}>
                      {nameOf(item.user)} · {item.user.email}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!assignment.tutor_user_id || !assignment.student_user_id}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <Plus size={16} />
                  Asignar
                </button>
              </form>
            </section>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-4 nice-shadow">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Bell size={17} />
              Notificaciones
            </h2>
            {summary?.notifications?.length ? (
              <div className="space-y-2">
                {summary.notifications.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg bg-gray-50 p-3">
                    <div className="text-sm font-medium text-gray-800">{item.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.body}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin notificaciones nuevas.</p>
            )}
          </section>
        </aside>

        <main className="space-y-5">
          {!summary?.is_tutor && !summary?.is_admin && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 nice-shadow">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Calendario disponible</h2>
              {selectedTutor ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(groupedSlots).map(([date, daySlots]) => (
                    <div key={date} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="mb-3 text-sm font-semibold text-gray-800">
                        {new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(date))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {daySlots.map((slot) => (
                          <button
                            key={slot.starts_at}
                            disabled={!slot.available}
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                              selectedSlot?.starts_at === slot.starts_at
                                ? 'bg-gray-900 text-white'
                                : slot.available
                                  ? 'bg-white text-gray-700 hover:bg-gray-900 hover:text-white'
                                  : 'bg-gray-100 text-gray-300'
                            }`}
                          >
                            {new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date(slot.starts_at))}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!slots?.length && (
                    <div className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
                      No hay horarios disponibles para este tutor.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
                  Cuando tengas tutor asignado aparecerá aquí el calendario para reservar.
                </div>
              )}
              {selectedSlot && selectedTutor && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">Confirmar reserva</div>
                  <p className="mt-1 text-sm text-gray-500">
                    {nameOf(selectedTutor)} · {formatDate(selectedSlot.starts_at)}
                  </p>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Nota opcional para el tutor"
                    className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => setSelectedSlot(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
                      Cancelar
                    </button>
                    <button onClick={handleBook} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                      <Check size={16} />
                      Reservar
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-4 nice-shadow">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Próximas reservas</h2>
            <div className="space-y-3">
              {visibleSessions.map((item) => {
                const counterpart = currentUserId === item.tutor_user_id ? item.student : item.tutor
                return (
                  <div key={item.session_uuid} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{formatDate(item.starts_at)}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {currentUserId === item.tutor_user_id ? 'Alumno' : 'Tutor'}: {nameOf(counterpart)}
                      </div>
                      {item.student_notes && (
                        <div className="mt-1 text-xs text-gray-500">Nota: {item.student_notes}</div>
                      )}
                    </div>
                    {item.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancel(item)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-red-200 hover:text-red-600"
                      >
                        <X size={15} />
                        Cancelar
                      </button>
                    )}
                  </div>
                )
              })}
              {!visibleSessions.length && (
                <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
                  Todavía no hay reservas.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
