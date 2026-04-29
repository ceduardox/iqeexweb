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

export type ReadingAIGeneratedMaterial = {
  title: string
  description?: string
  program_name: string
  age_min: number
  age_max: number
  text_content: string
  questions: ReadingQuestion[]
  estimated_reading_seconds: number
  source: string
}

export type ReadingProgramAssignment = {
  id: number
  collection_uuid: string
  name: string
  public: boolean
  usergroup_id?: number
  instructors: Array<Record<string, any>>
  students: Array<Record<string, any>>
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
  answers: Array<Record<string, any>>
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

export async function generateReadingMaterial(
  orgId: number,
  data: {
    title?: string
    program_name: string
    age_min: number
    age_max: number
    prompt?: string
    source_text?: string
    target_words: number
    question_count: number
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/generate`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function generateReadingMaterialFromPdf(
  orgId: number,
  data: {
    file: File
    title?: string
    program_name: string
    age_min: number
    age_max: number
    prompt?: string
    target_words: number
    question_count: number
  },
  accessToken?: string
) {
  const formData = new FormData()
  formData.append('pdf', data.file)
  formData.append('title', data.title || '')
  formData.append('program_name', data.program_name)
  formData.append('age_min', String(data.age_min))
  formData.append('age_max', String(data.age_max))
  formData.append('prompt', data.prompt || '')
  formData.append('target_words', String(data.target_words))
  formData.append('question_count', String(data.question_count))

  const result = await fetch(`${getAPIUrl()}reading-test/org/${orgId}/generate-from-pdf`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  })
  return errorHandling(result)
}

export async function getReadingProgramAssignments(orgId: number, accessToken?: string) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/program-assignments`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function getReadingProgramAssignableUsers(orgId: number, accessToken?: string) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/program-assignable-users`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken)
  )
  return errorHandling(result)
}

export async function assignReadingProgramInstructor(
  orgId: number,
  data: { collection_uuid: string; user_id: number },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/program-assignments/instructors`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}

export async function assignReadingProgramStudent(
  orgId: number,
  data: { collection_uuid: string; user_id: number },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/program-assignments/students`,
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
    answers: Array<Record<string, any>>
  },
  accessToken?: string
) {
  const result = await fetch(
    `${getAPIUrl()}reading-test/org/${orgId}/attempts`,
    RequestBodyWithAuthHeader('POST', data, null, accessToken)
  )
  return errorHandling(result)
}
