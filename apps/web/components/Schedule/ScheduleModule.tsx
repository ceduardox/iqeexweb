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
  Mail,
  MapPin,
  Phone,
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
  updateScheduleSessionStatus,
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

function userContact(user?: ScheduleUser) {
  const details = user?.details || {}
  const whatsapp = details.whatsapp || {}
  const location = details.location || {}
  const phone = whatsapp.international_phone || `${whatsapp.dial_code || ''}${whatsapp.phone || ''}`.trim()
  return {
    phone,
    country: location.country || location.country_code || '',
    region: location.region || '',
  }
}

function statusInfo(status: ScheduleSession['status']) {
  if (status === 'completed') return { label: 'Realizada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' }
  if (status === 'no_show') return { label: 'No asistio', cls: 'bg-amber-50 text-amber-700 ring-amber-100' }
  if (status === 'cancelled') return { label: 'Cancelada', cls: 'bg-red-50 text-red-700 ring-red-100' }
  return { label: 'Programada', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-100' }
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function SectionIcon({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      {children}
    </span>
  )
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
  const scheduledSessions = visibleSessions.filter((item) => item.status === 'scheduled')
  const completedSessions = visibleSessions.filter((item) => item.status === 'completed')
  const uniqueStudentCount = new Set(visibleSessions.map((item) => item.student_user_id)).size
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

  async function handleStatusUpdate(item: ScheduleSession, status: 'completed' | 'no_show') {
    const defaultText = status === 'completed' ? 'Tutoria realizada' : 'El alumno no asistio'
    const instructorNotes = window.prompt('Nota interna del instructor', item.instructor_notes || defaultText)
    if (instructorNotes === null) return
    try {
      await updateScheduleSessionStatus(
        orgId,
        item.session_uuid,
        {
          status,
          instructor_notes: instructorNotes,
        },
        token
      )
      toast.success(status === 'completed' ? 'Tutoria marcada como realizada' : 'Tutoria marcada como no asistio')
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar el estado')
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
        <div className="rounded-lg border border-indigo-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <CalendarDays size={30} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Agenda</h1>
          <p className="mt-2 text-sm text-gray-500">Inicia sesion para ver tus tutorias.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={dashboard ? 'h-full w-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8' : 'w-full bg-slate-50'}>
      <div className={dashboard ? 'mx-auto w-full max-w-7xl' : 'mx-auto w-full max-w-7xl px-4 py-6 sm:py-8'}>
        <div className="mb-6 overflow-hidden rounded-lg border border-indigo-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-indigo-700 via-violet-600 to-cyan-600 px-5 py-6 text-white sm:px-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                    <CalendarDays size={18} />
                  </span>
                  Agenda
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-normal text-white sm:text-3xl">
                  {summary?.is_tutor || summary?.is_admin ? 'Calendario de tutorias' : 'Agendar tutoria'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  {summary?.is_tutor || summary?.is_admin
                    ? 'Gestiona reservas, alumnos y disponibilidad desde un solo lugar.'
                    : 'Selecciona un tutor asignado y reserva una hora disponible.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
                <div className="rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase text-white/65">
                    {summary?.is_tutor || summary?.is_admin ? 'Pendientes' : 'Reservas'}
                  </div>
                  <div className="mt-1 text-xl font-bold">{scheduledSessions.length}</div>
                </div>
                <div className="rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase text-white/65">
                    {summary?.is_tutor || summary?.is_admin ? 'Realizadas' : 'Tutores'}
                  </div>
                  <div className="mt-1 text-xl font-bold">
                    {summary?.is_tutor || summary?.is_admin ? completedSessions.length : tutors.length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-indigo-100 bg-white shadow-sm">
              <div className="h-1 bg-gradient-to-r from-indigo-500 to-cyan-500" />
              <div className="p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <SectionIcon tone="bg-indigo-50 text-indigo-700">
                    <UserRound size={17} />
                  </SectionIcon>
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
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                            : 'border-indigo-100 bg-indigo-50/40 text-gray-700 hover:border-indigo-300 hover:bg-white'
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
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                    {summary?.is_tutor || summary?.is_admin
                      ? `${uniqueStudentCount} alumno${uniqueStudentCount === 1 ? '' : 's'} con reservas registradas. Puedes revisar datos, marcar asistencia y configurar disponibilidad.`
                      : 'Aun no tienes tutor asignado. El recurso esta visible, pero un administrador debe asignarte un tutor para reservar.'}
                  </div>
                )}
              </div>
            </section>

            {(summary?.is_tutor || summary?.is_admin) && (
              <section className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <SectionIcon tone="bg-emerald-50 text-emerald-700">
                    <Clock size={17} />
                  </SectionIcon>
                  Disponibilidad
                </h2>
                <form onSubmit={handleAvailabilitySubmit} className="space-y-3">
                  <select
                    value={availability.weekday}
                    onChange={(event) => setAvailability({ ...availability, weekday: Number(event.target.value) })}
                    className="w-full rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white"
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
                      className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                    />
                    <input
                      type="time"
                      value={availability.end_time}
                      onChange={(event) => setAvailability({ ...availability, end_time: event.target.value })}
                      className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                    />
                  </div>
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
                    <Plus size={16} />
                    Agregar horario
                  </button>
                </form>
              </section>
            )}

            {summary?.is_admin && (
              <section className="rounded-lg border border-violet-100 bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <SectionIcon tone="bg-violet-50 text-violet-700">
                    <UserRound size={17} />
                  </SectionIcon>
                  Asignar tutor
                </h2>
                <form onSubmit={handleAssignmentSubmit} className="space-y-3">
                  <select
                    value={assignment.tutor_user_id}
                    onChange={(event) => setAssignment({ ...assignment, tutor_user_id: event.target.value })}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:bg-white"
                  >
                    <option value="">Tutor o profesor</option>
                    {(orgUsers?.items || []).map((item: any) => (
                      <option key={`tutor-${item.user.id}`} value={item.user.id}>
                        {nameOf(item.user)} - {item.role?.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignment.student_user_id}
                    onChange={(event) => setAssignment({ ...assignment, student_user_id: event.target.value })}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:bg-white"
                  >
                    <option value="">Alumno</option>
                    {(orgUsers?.items || []).map((item: any) => (
                      <option key={`student-${item.user.id}`} value={item.user.id}>
                        {nameOf(item.user)} - {item.user.email}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!assignment.tutor_user_id || !assignment.student_user_id}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    <Plus size={16} />
                    Asignar
                  </button>
                </form>
              </section>
            )}

            <section className="rounded-lg border border-cyan-100 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <SectionIcon tone="bg-cyan-50 text-cyan-700">
                  <Bell size={17} />
                </SectionIcon>
                Notificaciones
              </h2>
              {summary?.notifications?.length ? (
                <div className="space-y-2">
                  {summary.notifications.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
                      <div className="text-sm font-medium text-gray-800">{item.title}</div>
                      <div className="mt-1 text-xs text-cyan-800/70">{item.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Sin notificaciones nuevas.</p>
              )}
            </section>
          </aside>

          <main className="space-y-5">
            {!summary?.is_tutor && !summary?.is_admin && (
              <section className="rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <SectionIcon tone="bg-indigo-50 text-indigo-700">
                    <CalendarDays size={17} />
                  </SectionIcon>
                  Calendario disponible
                </h2>
                {selectedTutor ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Object.entries(groupedSlots).map(([date, daySlots]) => (
                      <div key={date} className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                        <div className="mb-3 text-sm font-semibold capitalize text-indigo-950">
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
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : slot.available
                                    ? 'bg-white text-indigo-800 ring-1 ring-indigo-100 hover:bg-indigo-600 hover:text-white'
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
                      <div className="rounded-lg border border-amber-100 bg-amber-50 p-6 text-sm leading-6 text-amber-800">
                        No hay horarios disponibles para este tutor.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-sm leading-6 text-amber-800">
                    Cuando tengas tutor asignado aparecera aqui el calendario para reservar.
                  </div>
                )}
                {selectedSlot && selectedTutor && (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
                    <div className="text-sm font-semibold text-gray-900">Confirmar reserva</div>
                    <p className="mt-1 text-sm text-gray-500">
                      {nameOf(selectedTutor)} - {formatDate(selectedSlot.starts_at)}
                    </p>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      placeholder="Nota opcional para el tutor"
                      className="mt-3 w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => setSelectedSlot(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-white">
                        Cancelar
                      </button>
                      <button onClick={handleBook} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                        <Check size={16} />
                        Reservar
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <SectionIcon tone="bg-slate-100 text-slate-700">
                  <Clock size={17} />
                </SectionIcon>
                {summary?.is_tutor || summary?.is_admin ? 'Reservas y asistencia' : 'Proximas reservas'}
              </h2>
              <div className="space-y-3">
                {visibleSessions.map((item) => {
                  const isTutorView = currentUserId === item.tutor_user_id
                  const canManageStatus = Boolean(summary?.is_admin || isTutorView)
                  const studentContact = userContact(item.student)
                  const badge = statusInfo(item.status)
                  return (
                    <div key={item.session_uuid} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">{formatDate(item.starts_at)}</div>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-1 text-sm text-gray-600">
                            <div><span className="font-medium text-gray-900">Alumno:</span> {nameOf(item.student)}</div>
                            {(summary?.is_admin || !isTutorView) && (
                              <div><span className="font-medium text-gray-900">Tutor:</span> {nameOf(item.tutor)}</div>
                            )}
                          </div>
                        </div>
                        {item.status === 'scheduled' && (
                          <div className="flex flex-wrap gap-2">
                            {canManageStatus && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(item, 'completed')}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50"
                                >
                                  <Check size={15} />
                                  Realizada
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(item, 'no_show')}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-amber-700 hover:border-amber-200 hover:bg-amber-50"
                                >
                                  <X size={15} />
                                  No asistio
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleCancel(item)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-sm text-red-600 hover:border-red-200 hover:bg-red-50"
                            >
                              <X size={15} />
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 grid gap-2 rounded-lg border border-white bg-white/70 p-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-slate-400" />
                          <span className="truncate">{item.student.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" />
                          <span>{studentContact.phone || 'Sin WhatsApp'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400" />
                          <span>{studentContact.country || 'Sin pais'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400" />
                          <span>{studentContact.region || 'Sin region'}</span>
                        </div>
                      </div>
                      {(item.student_notes || item.instructor_notes || item.status_marked_at) && (
                        <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                          {item.student_notes && <div className="rounded-lg bg-white p-3">Nota alumno: {item.student_notes}</div>}
                          {item.instructor_notes && <div className="rounded-lg bg-white p-3">Nota instructor: {item.instructor_notes}</div>}
                          {item.status_marked_at && (
                            <div className="rounded-lg bg-white p-3">
                              Marcado: {formatDate(item.status_marked_at)}
                              {item.status_marked_by ? ` por ${nameOf(item.status_marked_by)}` : ''}
                            </div>
                          )}
                        </div>
                      )}
                      {!item.status_marked_at && item.status === 'scheduled' && canManageStatus && (
                        <div className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-500">
                          Asistencia pendiente de marcar.
                        </div>
                      )}
                    </div>
                  )
                })}
                {!visibleSessions.length && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Todavia no hay reservas.
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
