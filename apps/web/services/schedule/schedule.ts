import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  errorHandling,
} from '@services/utils/ts/requests'

export type ScheduleUser = {
  id: number
  user_uuid: string
  username: string
  first_name?: string
  last_name?: string
  email: string
  avatar_image?: string
  details?: any
  bio?: string
}

export type ScheduleSession = {
  id: number
  session_uuid: string
  tutor_user_id: number
  student_user_id: number
  tutor: ScheduleUser
  student: ScheduleUser
  starts_at: string
  ends_at: string
  timezone: string
  student_notes?: string
  status: 'scheduled' | 'cancelled' | 'completed' | 'no_show'
  status_marked_by?: ScheduleUser | null
  status_marked_by_id?: number | null
  status_marked_at?: string | null
  instructor_notes?: string
  cancellation_reason?: string
}

export type ScheduleSummary = {
  is_admin: boolean
  is_tutor: boolean
  assigned_tutors: ScheduleUser[]
  upcoming_sessions: ScheduleSession[]
  notifications: Array<{
    id: number
    notification_uuid: string
    title: string
    body: string
    session_uuid?: string
    read_at?: string
    creation_date: string
  }>
}

export type ScheduleSlot = {
  starts_at: string
  ends_at: string
  available: boolean
}

export type TutorAvailability = {
  id: number
  availability_uuid: string
  org_id: number
  tutor_user_id: number
  weekday: number
  start_time: string
  end_time: string
  slot_minutes: number
  timezone: string
  active: boolean
  creation_date: string
  update_date: string
}

export async function getScheduleSummary(orgId: number, accessToken?: string) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/summary`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function getTutorSlots(
  orgId: number,
  tutorUserId: number,
  fromDate: string,
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/tutors/${tutorUserId}/slots?from_date=${fromDate}&days=7`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function getScheduleSessions(orgId: number, accessToken?: string) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/sessions`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function createScheduleSession(
  orgId: number,
  data: {
    tutor_user_id: number
    starts_at: string
    ends_at: string
    timezone: string
    student_notes?: string
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/sessions`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function cancelScheduleSession(
  orgId: number,
  sessionUuid: string,
  reason: string,
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/sessions/${sessionUuid}/cancel`,
    RequestBodyWithAuthHeader('POST', { reason }, null, accessToken)
  )
  return errorHandling(result)
}

export async function updateScheduleSessionStatus(
  orgId: number,
  sessionUuid: string,
  data: {
    status: 'scheduled' | 'completed' | 'no_show'
    instructor_notes?: string
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/sessions/${sessionUuid}/status`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function getTutorAvailability(
  orgId: number,
  tutorUserId: number,
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/tutors/${tutorUserId}/availability`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function createTutorAvailability(
  orgId: number,
  data: {
    tutor_user_id: number
    weekday: number
    start_time: string
    end_time: string
    slot_minutes: number
    timezone: string
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/availability`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function updateTutorAvailability(
  orgId: number,
  availabilityUuid: string,
  data: {
    weekday: number
    start_time: string
    end_time: string
    slot_minutes: number
    timezone: string
    active?: boolean
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/availability/${availabilityUuid}`,
    RequestBodyWithAuthHeader('PATCH', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function deleteTutorAvailability(
  orgId: number,
  availabilityUuid: string,
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/availability/${availabilityUuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function createTutorAssignment(
  orgId: number,
  data: {
    tutor_user_id: number
    student_user_id: number
    course_id?: number | null
    active?: boolean
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}schedule/org/${orgId}/assignments`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function getOrgUsersForSchedule(orgId: number, accessToken?: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${orgId}/users?page=1&limit=100`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}
