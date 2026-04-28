import { getAPIUrl } from '@services/config/config'
import {
  RequestBodyWithAuthHeader,
  errorHandling,
} from '@services/utils/ts/requests'

export type ReadingQuestion = {
  q: string
  a: string
  choices: string[]
}

export type ReadingMaterial = {
  id: number
  material_uuid: string
  title: string
  description?: string
  program_name: string
  age_min: number
  age_max: number
  pdf_name?: string
  text_content: string
  questions: ReadingQuestion[]
  status: 'draft' | 'published' | 'archived'
  created_by_id: number
  creation_date: string
  update_date: string
}

export type ReadingAttempt = {
  id: number
  attempt_uuid: string
  material_id: number
  student_user_id: number
  duration_seconds: number
  words_count: number
  wpm: number
  comprehension: number
  retention: number
  level: string
  answers: Array<{ question: string; answer: string; correct: boolean }>
  creation_date: string
  material?: ReadingMaterial
}

export async function getReadingMaterials(orgId: number, accessToken?: string) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/materials`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function createReadingMaterial(
  orgId: number,
  data: {
    title: string
    description?: string
    program_name: string
    age_min: number
    age_max: number
    pdf_name?: string
    text_content: string
    questions: ReadingQuestion[]
    status?: 'draft' | 'published' | 'archived'
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/materials`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function getReadingAttempts(orgId: number, materialId?: number | null, accessToken?: string) {
  const query = materialId ? `?material_id=${materialId}` : ''
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/attempts${query}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function createReadingAttempt(
  orgId: number,
  data: {
    material_id: number
    duration_seconds: number
    words_count: number
    wpm: number
    comprehension: number
    retention: number
    level: string
    answers: Array<{ question: string; answer: string; correct: boolean }>
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/attempts`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}
