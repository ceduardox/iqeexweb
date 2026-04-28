'use client'

import React, { useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import toast from 'react-hot-toast'
import {
  BarChart3,
  BookOpenCheck,
  Check,
  Clock3,
  FileText,
  LineChart,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  createReadingAttempt,
  createReadingMaterial,
  generateReadingMaterial,
  generateReadingMaterialFromPdf,
  getReadingAttempts,
  getReadingMaterials,
  ReadingAttempt,
  ReadingMaterial,
  ReadingQuestion,
} from '@services/reading-test/reading-test'

type ReadingTestModuleProps = {
  orgId: number
  dashboard?: boolean
}

type Role = 'admin' | 'instructor' | 'student'
type View = 'material' | 'test' | 'reports'

const sampleText =
  'La lectura eficiente no consiste en recorrer palabras con prisa, sino en construir significado con control. Un lector competente anticipa ideas, identifica relaciones y separa informacion central de detalles secundarios. Cuando la atencion se mantiene estable, la memoria de trabajo puede organizar mejor los conceptos y recuperar despues lo aprendido. Por eso, una prueba de lectura debe medir velocidad, pero tambien comprension y retencion. Si solo se mide rapidez, el alumno puede sacrificar precision. Si solo se mide comprension, no se observa el esfuerzo temporal. La combinacion de ambos datos permite detectar si el estudiante necesita entrenar enfoque, amplitud visual, vocabulario, memoria o estrategias de resumen.'

const defaultQuestions: ReadingQuestion[] = [
  {
    q: 'Cual es la idea principal?',
    a: 'La lectura debe medir velocidad, comprension y retencion.',
    choices: [
      'Leer rapido siempre es suficiente.',
      'La lectura debe medir velocidad, comprension y retencion.',
      'La memoria no participa en la lectura.',
    ],
  },
  {
    q: 'Que pasa si solo se mide rapidez?',
    a: 'El alumno puede sacrificar precision.',
    choices: ['El alumno puede sacrificar precision.', 'El alumno nunca mejora.', 'El PDF se vuelve mas corto.'],
  },
  {
    q: 'Que detecta la combinacion de datos?',
    a: 'Necesidades de enfoque, memoria, vocabulario o estrategias.',
    choices: [
      'Edad exacta del profesor.',
      'Necesidades de enfoque, memoria, vocabulario o estrategias.',
      'Cantidad de imagenes del PDF.',
    ],
  },
  {
    q: 'Que ayuda a organizar conceptos?',
    a: 'La atencion estable.',
    choices: ['La atencion estable.', 'El azar.', 'Leer sin comprender.'],
  },
]

const initialAttempts = [
  { date: '12 abr', wpm: 132, comp: 58, adjusted: 58, ret: 61, level: 'Entrenar', timeFlag: 'normal' },
  { date: '18 abr', wpm: 148, comp: 66, adjusted: 66, ret: 68, level: 'Funcional', timeFlag: 'normal' },
  { date: '25 abr', wpm: 168, comp: 78, adjusted: 78, ret: 76, level: 'Funcional', timeFlag: 'normal' },
]

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function formatTime(seconds: number) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const rest = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

function expectedMaxWpm(ageMin: number, ageMax: number) {
  const age = (ageMin + ageMax) / 2
  if (age <= 10) return 150
  if (age <= 13) return 190
  if (age <= 16) return 240
  return 320
}

function calculateTimeAdjustment(words: number, seconds: number, ageMin: number, ageMax: number) {
  const maxWpm = expectedMaxWpm(ageMin, ageMax)
  const minimumSeconds = Math.max(15, Math.round((words / maxWpm) * 60))
  const ratio = seconds / minimumSeconds
  if (ratio < 0.45) {
    return { factor: 0.45, minimumSeconds, maxWpm, flag: 'sospechoso' }
  }
  if (ratio < 0.7) {
    return { factor: 0.7, minimumSeconds, maxWpm, flag: 'muy rapido' }
  }
  if (ratio < 0.9) {
    return { factor: 0.88, minimumSeconds, maxWpm, flag: 'rapido' }
  }
  return { factor: 1, minimumSeconds, maxWpm, flag: 'normal' }
}

function SectionIcon({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{children}</span>
}

export default function ReadingTestModule({ orgId, dashboard = false }: ReadingTestModuleProps) {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [role, setRole] = useState<Role>('admin')
  const [view, setView] = useState<View>('material')
  const [title, setTitle] = useState('Lectura diagnostica')
  const [program, setProgram] = useState('Lectura 12-14 anos')
  const [ageMin, setAgeMin] = useState(12)
  const [ageMax, setAgeMax] = useState(14)
  const [fileName, setFileName] = useState('Ningun PDF seleccionado')
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [readingText, setReadingText] = useState(sampleText)
  const [readingQuestions, setReadingQuestions] = useState<ReadingQuestion[]>(defaultQuestions)
  const [aiPrompt, setAiPrompt] = useState('Genera una lectura clara con preguntas literales e inferenciales.')
  const [targetWords, setTargetWords] = useState(500)
  const [questionCount, setQuestionCount] = useState(6)
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('Prepara la lectura para comenzar.')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isReading, setIsReading] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [showQuestions, setShowQuestions] = useState(false)
  const [localAttempts, setLocalAttempts] = useState(initialAttempts)
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null)

  const materialsKey = token && orgId ? ['reading-materials', orgId, token] : null
  const attemptsKey = token && orgId ? ['reading-attempts', orgId, selectedMaterialId || 'all', token] : null

  const { data: materials } = useSWR<ReadingMaterial[]>(
    materialsKey,
    () => getReadingMaterials(orgId, token),
    { revalidateOnFocus: false }
  )
  const { data: apiAttempts } = useSWR<ReadingAttempt[]>(
    attemptsKey,
    () => getReadingAttempts(orgId, selectedMaterialId, token),
    { revalidateOnFocus: false }
  )

  React.useEffect(() => {
    if (!isReading || !startedAt) return
    const tick = window.setInterval(() => {
      setElapsed(Math.max(1, Math.round((Date.now() - startedAt) / 1000)))
    }, 250)
    return () => window.clearInterval(tick)
  }, [isReading, startedAt])

  React.useEffect(() => {
    const material = materials?.[0]
    if (!material || selectedMaterialId) return
    setSelectedMaterialId(material.id)
    setTitle(material.title)
    setProgram(material.program_name)
    setAgeMin(material.age_min)
    setAgeMax(material.age_max)
    setFileName(material.pdf_name || 'PDF registrado')
    setReadingText(material.text_content)
    setReadingQuestions(material.questions?.length ? material.questions : defaultQuestions)
  }, [materials, selectedMaterialId])

  const normalizedAttempts = apiAttempts?.length
    ? apiAttempts.map((attempt) => ({
        date: new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(attempt.creation_date)),
        wpm: attempt.wpm,
        comp: attempt.comprehension,
        adjusted: Number((attempt.answers || []).find((answer: any) => answer.type === 'score_meta')?.adjusted_score || attempt.comprehension),
        ret: attempt.retention,
        level: attempt.level,
        timeFlag: (attempt.answers || []).find((answer: any) => answer.type === 'score_meta')?.time_flag || 'normal',
      }))
    : localAttempts
  const latest = normalizedAttempts[normalizedAttempts.length - 1]
  const wordCount = useMemo(() => countWords(readingText), [readingText])
  const bestComprehension = Math.max(...normalizedAttempts.map((item) => item.adjusted))
  const bestWpm = Math.max(...normalizedAttempts.map((item) => item.wpm))
  const canManageMaterial = role !== 'student'

  async function saveMaterial(materialStatus: 'draft' | 'published' = 'published') {
    if (!canManageMaterial) return
    try {
      const material = await createReadingMaterial(
        orgId,
        {
          title,
          description: 'Material de lectura por programa',
          program_name: program,
          age_min: ageMin,
          age_max: ageMax,
          pdf_name: fileName === 'Ningun PDF seleccionado' ? '' : fileName,
          text_content: readingText,
          questions: readingQuestions,
          status: materialStatus,
        },
        token
      )
      setSelectedMaterialId(material.id)
      await mutate(materialsKey)
      toast.success(materialStatus === 'published' ? 'Material publicado' : 'Borrador guardado')
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar el material')
    }
  }

  async function generateWithAI() {
    if (!canManageMaterial || isGenerating) return
    setIsGenerating(true)
    setStatus('La IA esta generando la lectura y el test.')
    try {
      const generated = selectedPdfFile
        ? await generateReadingMaterialFromPdf(
            orgId,
            {
              file: selectedPdfFile,
              title,
              program_name: program,
              age_min: ageMin,
              age_max: ageMax,
              prompt: aiPrompt,
              target_words: targetWords,
              question_count: questionCount,
            },
            token
          )
        : await generateReadingMaterial(
            orgId,
            {
              title,
              program_name: program,
              age_min: ageMin,
              age_max: ageMax,
              prompt: aiPrompt,
              source_text: readingText,
              target_words: targetWords,
              question_count: questionCount,
            },
            token
          )
      setTitle(generated.title)
      setProgram(generated.program_name)
      setAgeMin(generated.age_min)
      setAgeMax(generated.age_max)
      setReadingText(generated.text_content)
      setReadingQuestions(generated.questions?.length ? generated.questions : defaultQuestions)
      setSelectedMaterialId(null)
      setStatus('Borrador generado con IA. Revisalo y publicalo cuando este listo.')
      toast.success('Test generado con IA')
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar con IA')
      setStatus('No se pudo generar con IA. Revisa la configuracion o intenta con mas texto.')
    } finally {
      setIsGenerating(false)
    }
  }

  function prepareTest() {
    setView('test')
    setShowQuestions(false)
    setAnswers({})
    setElapsed(0)
    setStartedAt(null)
    setIsReading(false)
    setStatus('Lectura preparada. El alumno puede iniciar cuando este listo.')
  }

  function startReading() {
    setStartedAt(Date.now())
    setElapsed(0)
    setIsReading(true)
    setStatus('Lectura en curso.')
  }

  function finishReading() {
    setIsReading(false)
    setElapsed((current) => Math.max(1, current))
    setShowQuestions(true)
    setStatus('Responde sin volver al texto.')
  }

  async function gradeTest() {
    const correct = readingQuestions.reduce((total, item, index) => total + (answers[index] === item.a ? 1 : 0), 0)
    const duration = Math.max(1, elapsed || 1)
    const wpm = Math.round(wordCount / (duration / 60))
    const comp = Math.round((correct / readingQuestions.length) * 100)
    const timeAdjustment = calculateTimeAdjustment(wordCount, duration, ageMin, ageMax)
    const adjusted = Math.round(comp * timeAdjustment.factor)
    const ret = Math.max(0, Math.min(100, Math.round(adjusted * 0.76 + (Math.min(wpm, timeAdjustment.maxWpm) / timeAdjustment.maxWpm) * 24)))
    const level = adjusted >= 85 && wpm >= 180 ? 'Avanzado' : adjusted >= 65 && wpm >= 120 ? 'Funcional' : 'Entrenar'
    if (selectedMaterialId) {
      try {
        await createReadingAttempt(
          orgId,
          {
            material_id: selectedMaterialId,
            duration_seconds: duration,
            words_count: wordCount,
            wpm,
            comprehension: comp,
            retention: ret,
            level,
            answers: [
              {
                type: 'score_meta',
                raw_comprehension: comp,
                adjusted_score: adjusted,
                time_factor: timeAdjustment.factor,
                time_flag: timeAdjustment.flag,
                minimum_seconds: timeAdjustment.minimumSeconds,
                expected_max_wpm: timeAdjustment.maxWpm,
              },
              ...readingQuestions.map((item, index) => ({
                question: item.q,
                answer: answers[index] || '',
                correct: answers[index] === item.a,
              })),
            ],
          },
          token
        )
        await mutate(attemptsKey)
        toast.success('Intento guardado')
      } catch (error: any) {
        toast.error(error?.message || 'No se pudo guardar el intento')
        setLocalAttempts((items) => [...items, { date: 'Hoy', wpm, comp, adjusted, ret, level, timeFlag: timeAdjustment.flag }])
      }
    } else {
      setLocalAttempts((items) => [...items, { date: 'Hoy', wpm, comp, adjusted, ret, level, timeFlag: timeAdjustment.flag }])
    }
    setStatus('Resultado calculado.')
    setView('reports')
  }

  function resetAttempt() {
    setShowQuestions(false)
    setAnswers({})
    setElapsed(0)
    setStartedAt(null)
    setIsReading(false)
    setStatus('Prepara la lectura para comenzar.')
  }

  return (
    <div className={dashboard ? 'h-full w-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8' : 'w-full bg-slate-50'}>
      <div className={dashboard ? 'mx-auto w-full max-w-7xl' : 'mx-auto w-full max-w-7xl px-4 py-6 sm:py-8'}>
        <div className="mb-6 overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-700 px-5 py-6 text-white sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                    <BookOpenCheck size={18} />
                  </span>
                  Test de lectura
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-normal text-white sm:text-3xl">
                  Lectura, comprension y retencion
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
                  Prototipo integrado al LMS para PDFs por programa, intentos del alumno y reportes de progreso.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[360px] sm:grid-cols-4">
                <div className="rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase text-white/65">Intentos</div>
                  <div className="mt-1 text-xl font-bold">{normalizedAttempts.length}</div>
                </div>
                <div className="rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase text-white/65">Mejor WPM</div>
                  <div className="mt-1 text-xl font-bold">{bestWpm}</div>
                </div>
                <div className="rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase text-white/65">Puntaje</div>
                  <div className="mt-1 text-xl font-bold">{bestComprehension}%</div>
                </div>
                <div className="rounded-lg bg-white/12 px-3 py-2 ring-1 ring-white/15">
                  <div className="text-[11px] font-semibold uppercase text-white/65">Edad</div>
                  <div className="mt-1 text-xl font-bold">{ageMin}-{ageMax}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['material', 'test', 'reports'] as View[]).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  view === item ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item === 'material' ? 'Material' : item === 'test' ? 'Prueba alumno' : 'Reportes'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['admin', 'instructor', 'student'] as Role[]).map((item) => (
              <button
                key={item}
                onClick={() => setRole(item)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  role === item ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                }`}
              >
                Vista {item === 'student' ? 'alumno' : item}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ['1. PDF o IA', 'Admin/profesor carga o genera material.'],
            ['2. Revision', 'La IA propone texto y preguntas.'],
            ['3. Publicacion', 'Se asigna por edad y programa.'],
            ['4. Reporte', 'Intentos, progreso y recomendacion.'],
          ].map(([title, description]) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-sm leading-5 text-slate-500">{description}</div>
            </div>
          ))}
        </div>

        {view === 'material' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[390px_1fr]">
            <section className="rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <SectionIcon tone="bg-sky-50 text-sky-700">
                  <FileText size={17} />
                </SectionIcon>
                Biblioteca de lectura
              </h2>
              {!canManageMaterial && (
                <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                  El alumno ve el material asignado segun su programa. La carga de PDFs queda para admin e instructor.
                </div>
              )}
              <label className="block cursor-pointer rounded-lg border border-dashed border-sky-200 bg-sky-50/50 p-5 text-center">
                <Upload className="mx-auto mb-2 text-sky-600" size={28} />
                <span className="block text-sm font-semibold text-slate-900">Subir PDF de lectura</span>
                <span className="mt-1 block text-xs text-slate-500">{fileName}</span>
                <input
                  disabled={!canManageMaterial}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null
                    setSelectedPdfFile(file)
                    setFileName(file?.name || 'Ningun PDF seleccionado')
                  }}
                />
              </label>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Material guardado
                  <select
                    value={selectedMaterialId || ''}
                    onChange={(event) => {
                      const material = materials?.find((item) => item.id === Number(event.target.value))
                      setSelectedMaterialId(material?.id || null)
                      if (material) {
                        setTitle(material.title)
                        setProgram(material.program_name)
                        setAgeMin(material.age_min)
                        setAgeMax(material.age_max)
                        setFileName(material.pdf_name || 'PDF registrado')
                        setReadingText(material.text_content)
                        setReadingQuestions(material.questions?.length ? material.questions : defaultQuestions)
                      }
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  >
                    <option value="">Nuevo material</option>
                    {(materials || []).map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.title} - {material.program_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Titulo
                  <input
                    disabled={!canManageMaterial}
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Programa
                  <select
                    disabled={!canManageMaterial}
                    value={program}
                    onChange={(event) => setProgram(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  >
                    <option>Lectura 8-10 anos</option>
                    <option>Lectura 12-14 anos</option>
                    <option>Lectura 15-17 anos</option>
                    <option>Lectura adulto</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Edad minima
                    <input
                      disabled={!canManageMaterial}
                      type="number"
                      value={ageMin}
                      onChange={(event) => setAgeMin(Number(event.target.value))}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Edad maxima
                    <input
                      disabled={!canManageMaterial}
                      type="number"
                      value={ageMax}
                      onChange={(event) => setAgeMax(Number(event.target.value))}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    />
                  </label>
                </div>
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-900">
                    <Sparkles size={16} />
                    Generar test con IA
                  </div>
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    Instrucciones
                    <textarea
                      disabled={!canManageMaterial || isGenerating}
                      value={aiPrompt}
                      onChange={(event) => setAiPrompt(event.target.value)}
                      rows={3}
                      className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-violet-400"
                      placeholder="Tema, objetivo o enfoque de preguntas..."
                    />
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-sm font-semibold text-slate-700">
                      Palabras
                      <input
                        disabled={!canManageMaterial || isGenerating}
                        type="number"
                        value={targetWords}
                        onChange={(event) => setTargetWords(Number(event.target.value))}
                        className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-slate-700">
                      Preguntas
                      <input
                        disabled={!canManageMaterial || isGenerating}
                        type="number"
                        value={questionCount}
                        onChange={(event) => setQuestionCount(Number(event.target.value))}
                        className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                      />
                    </label>
                  </div>
                  <button
                    onClick={generateWithAI}
                    disabled={!canManageMaterial || isGenerating}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {selectedPdfFile ? 'Generar desde PDF' : 'Generar desde texto'}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <SectionIcon tone="bg-violet-50 text-violet-700">
                  <BookOpenCheck size={17} />
                </SectionIcon>
                Texto extraido / fragmento
              </h2>
              <textarea
                disabled={!canManageMaterial}
                value={readingText}
                onChange={(event) => setReadingText(event.target.value)}
                rows={9}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-sky-400 focus:bg-white"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-500">
                  {wordCount} palabras | {readingQuestions.length} preguntas | {program} | edades {ageMin}-{ageMax}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManageMaterial && (
                    <>
                      <button
                        onClick={() => saveMaterial('draft')}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50"
                      >
                        <Check size={16} />
                        Guardar borrador
                      </button>
                      <button
                        onClick={() => saveMaterial('published')}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                      >
                        <Check size={16} />
                        Publicar
                      </button>
                    </>
                  )}
                  <button
                    onClick={prepareTest}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    <Check size={16} />
                    Preparar prueba
                  </button>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">Preguntas del test</div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                    Revisar antes de publicar
                  </span>
                </div>
                <div className="grid gap-2">
                  {readingQuestions.map((question, index) => (
                    <div key={`${question.q}-${index}`} className="rounded-lg bg-white p-3 text-sm ring-1 ring-slate-100">
                      <div className="font-semibold text-slate-900">
                        {index + 1}. {question.q}
                      </div>
                      <div className="mt-1 text-xs text-emerald-700">Correcta: {question.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {view === 'test' && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <SectionIcon tone="bg-blue-50 text-blue-700">
                    <Clock3 size={17} />
                  </SectionIcon>
                  Intento del alumno
                </h2>
                <p className="mt-1 text-sm text-slate-500">{status}</p>
              </div>
              <div className="text-3xl font-bold text-blue-700">{formatTime(elapsed)}</div>
            </div>

            {!showQuestions ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-5 text-base leading-8 text-slate-800">
                {readingText || 'Aqui aparecera el texto asignado.'}
              </div>
            ) : (
              <div className="space-y-3">
                {readingQuestions.map((question, index) => (
                  <div key={question.q} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {index + 1}. {question.q}
                    </div>
                    <div className="mt-3 grid gap-2">
                      {question.choices.map((choice) => (
                        <label key={choice} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100 hover:bg-sky-50">
                          <input
                            type="radio"
                            name={`question-${index}`}
                            value={choice}
                            checked={answers[index] === choice}
                            onChange={() => setAnswers({ ...answers, [index]: choice })}
                          />
                          <span>{choice}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={startReading}
                disabled={isReading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Iniciar lectura
              </button>
              <button
                onClick={finishReading}
                disabled={!isReading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Termine de leer
              </button>
              {showQuestions && (
                <button
                  onClick={gradeTest}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Calcular resultado
                </button>
              )}
              <button
                onClick={resetAttempt}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reiniciar
              </button>
            </div>
          </section>
        )}

        {view === 'reports' && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <SectionIcon tone="bg-emerald-50 text-emerald-700">
                    <LineChart size={17} />
                  </SectionIcon>
                  Reporte de progreso
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {role === 'admin'
                    ? 'Admin ve alumnos, programas, PDFs e instructores.'
                    : role === 'instructor'
                      ? 'Instructor ve reportes de sus alumnos asignados.'
                      : 'Alumno ve sus intentos, fechas y recomendaciones.'}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Ultimo intento: {latest.date}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="text-2xl font-bold text-slate-900">{latest.wpm}</div>
                <div className="text-xs font-semibold uppercase text-slate-500">Palabras/min</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="text-2xl font-bold text-slate-900">{latest.comp}%</div>
                <div className="text-xs font-semibold uppercase text-slate-500">Comprension bruta</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="text-2xl font-bold text-slate-900">{latest.adjusted}%</div>
                <div className="text-xs font-semibold uppercase text-slate-500">Puntaje ajustado</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="text-2xl font-bold text-slate-900">{latest.level}</div>
                <div className="text-xs font-semibold uppercase text-slate-500">Nivel lector</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <BarChart3 size={17} />
                  Progreso comparativo
                </div>
                <svg viewBox="0 0 640 240" className="h-64 w-full">
                  <line x1="40" y1="200" x2="610" y2="200" stroke="#dce7f4" />
                  <line x1="40" y1="40" x2="40" y2="200" stroke="#dce7f4" />
                  <polyline fill="none" stroke="#5b2df5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" points="50,170 190,145 330,118 470,98 600,76" />
                  <polyline fill="none" stroke="#06b6d4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" points="50,182 190,160 330,140 470,120 600,104" />
                  <text x="48" y="224" fill="#667085" fontSize="12">Intento 1</text>
                  <text x="548" y="224" fill="#667085" fontSize="12">Actual</text>
                  <text x="56" y="32" fill="#5b2df5" fontSize="13">Comprension</text>
                  <text x="166" y="32" fill="#06b6d4" fontSize="13">Velocidad</text>
                </svg>
              </div>
              <div className="space-y-2">
                {normalizedAttempts.slice(-5).reverse().map((attempt) => (
                  <div key={`${attempt.date}-${attempt.wpm}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{attempt.date}</div>
                      <div className="text-xs text-slate-500">{attempt.level}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{attempt.adjusted}%</div>
                      <div className="text-xs text-slate-500">{attempt.wpm} wpm · {attempt.timeFlag}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
              <span className="font-semibold">Recomendacion:</span>{' '}
              {latest.timeFlag !== 'normal'
                ? 'el tiempo fue menor al minimo razonable; revisar si hubo lectura real antes de interpretar el resultado.'
                : latest.level === 'Avanzado'
                  ? 'subir complejidad del texto e incluir preguntas inferenciales.'
                  : latest.level === 'Funcional'
                    ? 'entrenar resumen, palabras clave y control de tiempo.'
                    : 'trabajar lectura guiada, vocabulario base e idea central.'}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
