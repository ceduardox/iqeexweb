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
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  List,
  Pencil,
  Save,
  Trash2,
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
  getTutorAvailability,
  deleteTutorAvailability,
  updateTutorAvailability,
  updateScheduleSessionStatus,
  ScheduleSession,
  ScheduleSlot,
  ScheduleSummary,
  ScheduleUser,
  TutorAvailability,
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

function localDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
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
  const [scheduleView, setScheduleView] = useState<'list' | 'month'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [availabilityTutorId, setAvailabilityTutorId] = useState('')
  const [editingBlock, setEditingBlock] = useState<{
    availability_uuid: string
    weekday: number
    start_time: string
    end_time: string
    slot_minutes: number
  } | null>(null)
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
  const availabilityTargetId = summary?.is_admin
    ? Number(availabilityTutorId || currentUserId || 0)
    : currentUserId
  const fromDate = useMemo(() => isoDate(new Date()), [])

  const { data: slots } = useSWR<ScheduleSlot[]>(
    token && orgId && tutorIdForSlots ? ['schedule-slots', orgId, tutorIdForSlots, fromDate, token] : null,
    () => getTutorSlots(orgId, tutorIdForSlots, fromDate, token),
    { revalidateOnFocus: false }
  )
  const availabilityKey = token && orgId && availabilityTargetId
    ? ['schedule-availability', orgId, availabilityTargetId, token]
    : null
  const { data: availabilityBlocks } = useSWR<TutorAvailability[]>(
    availabilityKey,
    () => getTutorAvailability(orgId, availabilityTargetId, token),
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
  const availabilityByDay = useMemo(() => {
    const groups: Record<number, TutorAvailability[]> = {}
    ;(availabilityBlocks || []).forEach((block) => {
      groups[block.weekday] = [...(groups[block.weekday] || []), block].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })
    return groups
  }, [availabilityBlocks])
  const monthDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const start = new Date(firstDay)
    start.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [calendarMonth])
  const sessionsByDay = useMemo(() => {
    const groups: Record<string, ScheduleSession[]> = {}
    visibleSessions.forEach((item) => {
      const key = localDateKey(new Date(item.starts_at))
      groups[key] = [...(groups[key] || []), item].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    })
    return groups
  }, [visibleSessions])
  const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(calendarMonth)

  async function refreshAll() {
    await mutate(summaryKey)
    await mutate(sessionsKey)
    if (tutorIdForSlots) {
      await mutate(['schedule-slots', orgId, tutorIdForSlots, fromDate, token])
    }
    if (availabilityKey) {
      await mutate(availabilityKey)
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
    if (!availabilityTargetId) {
      toast.error('Selecciona un instructor')
      return
    }
    try {
      await createTutorAvailability(
        orgId,
        {
          tutor_user_id: availabilityTargetId,
          ...availability,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
        token
      )
      toast.success('Disponibilidad agregada')
      setAvailability({
        ...availability,
        start_time: availability.end_time,
      })
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar disponibilidad')
    }
  }

  async function handleAvailabilityUpdate() {
    if (!editingBlock) return
    try {
      await updateTutorAvailability(
        orgId,
        editingBlock.availability_uuid,
        {
          weekday: editingBlock.weekday,
          start_time: editingBlock.start_time,
          end_time: editingBlock.end_time,
          slot_minutes: editingBlock.slot_minutes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          active: true,
        },
        token
      )
      toast.success('Bloque actualizado')
      setEditingBlock(null)
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar el bloque')
    }
  }

  async function handleAvailabilityDelete(block: TutorAvailability) {
    try {
      await deleteTutorAvailability(orgId, block.availability_uuid, token)
      toast.success('Bloque eliminado')
      if (editingBlock?.availability_uuid === block.availability_uuid) {
        setEditingBlock(null)
      }
      await refreshAll()
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo eliminar el bloque')
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
                  Bloques disponibles
                </h2>
                {summary?.is_admin && (
                  <select
                    value={availabilityTutorId}
                    onChange={(event) => setAvailabilityTutorId(event.target.value)}
                    className="mb-3 w-full rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                  >
                    <option value="">Mi usuario</option>
                    {(orgUsers?.items || []).map((item: any) => (
                      <option key={`availability-${item.user.id}`} value={item.user.id}>
                        {nameOf(item.user)} - {item.role?.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="mb-3 space-y-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                  {Object.keys(availabilityByDay).length ? (
                    dayLabels.map((label, index) => (
                      availabilityByDay[index]?.length ? (
                        <div key={label} className="space-y-2 text-xs text-emerald-900">
                          <span className="font-semibold">{label}</span>
                          {availabilityByDay[index].map((block) => (
                            editingBlock?.availability_uuid === block.availability_uuid ? (
                              <div key={block.id} className="grid gap-2 rounded-lg bg-white p-2 ring-1 ring-emerald-100">
                                <select
                                  value={editingBlock.weekday}
                                  onChange={(event) => setEditingBlock({ ...editingBlock, weekday: Number(event.target.value) })}
                                  className="rounded-lg border border-emerald-100 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-400"
                                >
                                  {dayLabels.map((dayLabel, dayIndex) => (
                                    <option key={dayLabel} value={dayIndex}>{dayLabel}</option>
                                  ))}
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="time"
                                    value={editingBlock.start_time}
                                    onChange={(event) => setEditingBlock({ ...editingBlock, start_time: event.target.value })}
                                    className="rounded-lg border border-emerald-100 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-400"
                                  />
                                  <input
                                    type="time"
                                    value={editingBlock.end_time}
                                    onChange={(event) => setEditingBlock({ ...editingBlock, end_time: event.target.value })}
                                    className="rounded-lg border border-emerald-100 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-400"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={handleAvailabilityUpdate}
                                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 font-medium text-white hover:bg-emerald-700"
                                  >
                                    <Save size={13} />
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingBlock(null)}
                                    className="rounded-lg border border-slate-200 px-2 py-2 text-slate-600 hover:bg-slate-50"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div key={block.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-2 ring-1 ring-emerald-100">
                                <span className="font-medium">{block.start_time} - {block.end_time}</span>
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingBlock({
                                      availability_uuid: block.availability_uuid,
                                      weekday: block.weekday,
                                      start_time: block.start_time,
                                      end_time: block.end_time,
                                      slot_minutes: block.slot_minutes,
                                    })}
                                    className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                                    aria-label="Editar bloque"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAvailabilityDelete(block)}
                                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                                    aria-label="Eliminar bloque"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      ) : null
                    ))
                  ) : (
                    <p className="text-xs leading-5 text-emerald-800">
                      Agrega bloques separados: por ejemplo 10:00-12:00 y otro bloque 15:00-18:00.
                    </p>
                  )}
                </div>
                <form onSubmit={handleAvailabilitySubmit} className="space-y-3">
                  <div className="rounded-lg bg-white p-3 text-xs leading-5 text-emerald-800 ring-1 ring-emerald-100">
                    Cada vez que presionas Agregar bloque se crea una franja independiente. Para partir el dia, agrega primero 10:00-12:00 y luego 15:00-18:00.
                  </div>
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
                    Agregar bloque
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

            {(summary?.is_tutor || summary?.is_admin) && (
              <section className="rounded-lg border border-indigo-100 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <SectionIcon tone="bg-indigo-50 text-indigo-700">
                      <CalendarRange size={17} />
                    </SectionIcon>
                    Calendario mensual
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setScheduleView(scheduleView === 'month' ? 'list' : 'month')}
                      className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      {scheduleView === 'month' ? <List size={16} /> : <CalendarRange size={16} />}
                      {scheduleView === 'month' ? 'Ver listado' : 'Ver calendario'}
                    </button>
                    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                        className="px-2 py-2 text-slate-500 hover:bg-slate-50"
                        aria-label="Mes anterior"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="min-w-[150px] px-3 text-center text-sm font-semibold capitalize text-slate-800">
                        {monthLabel}
                      </div>
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                        className="px-2 py-2 text-slate-500 hover:bg-slate-50"
                        aria-label="Mes siguiente"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {scheduleView === 'month' ? (
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[760px] grid-cols-7 gap-2">
                      {dayLabels.map((label) => (
                        <div key={label} className="px-2 text-xs font-semibold uppercase text-slate-400">
                          {label}
                        </div>
                      ))}
                      {monthDays.map((day) => {
                        const key = localDateKey(day)
                        const daySessions = sessionsByDay[key] || []
                        const outsideMonth = day.getMonth() !== calendarMonth.getMonth()
                        return (
                          <div
                            key={key}
                            className={`min-h-[128px] rounded-lg border p-2 ${
                              outsideMonth
                                ? 'border-slate-100 bg-slate-50/60 text-slate-300'
                                : 'border-indigo-100 bg-white text-slate-900'
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold">{day.getDate()}</span>
                              {daySessions.length > 0 && (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                  {daySessions.length}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {daySessions.slice(0, 4).map((item) => {
                                const badge = statusInfo(item.status)
                                return (
                                  <div key={item.session_uuid} className="rounded-md border border-slate-100 bg-slate-50 p-2">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[11px] font-semibold text-slate-800">{formatTime(item.starts_at)}</span>
                                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ${badge.cls}`}>
                                        {badge.label}
                                      </span>
                                    </div>
                                    <div className="mt-1 truncate text-[11px] text-slate-600">
                                      {nameOf(item.student)}
                                    </div>
                                    {summary?.is_admin && (
                                      <div className="truncate text-[10px] text-slate-400">
                                        {nameOf(item.tutor)}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              {daySessions.length > 4 && (
                                <div className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
                                  +{daySessions.length - 4} mas
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    Usa el boton Ver calendario para revisar tus citas por mes. El listado de abajo mantiene las acciones de asistencia.
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
