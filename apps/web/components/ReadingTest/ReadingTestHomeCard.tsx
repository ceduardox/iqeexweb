'use client'

import Link from 'next/link'
import { BookOpenCheck, ChevronRight, FileText, LineChart } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'

type ReadingTestHomeCardProps = {
  orgslug: string
  compact?: boolean
}

export default function ReadingTestHomeCard({ orgslug, compact = false }: ReadingTestHomeCardProps) {
  return (
    <section className={compact ? '' : 'mb-6'}>
      <Link
        href={getUriWithOrg(orgslug, '/reading-test')}
        className="group block overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
      >
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-600" />
        <div className="relative p-4">
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gradient-to-br from-sky-100/80 to-transparent" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm shadow-sky-200">
                <BookOpenCheck size={24} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-950">Test de lectura</h2>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100">
                    Nuevo
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600">
                  Sube PDFs por programa, mide lectura y revisa reportes de progreso por alumno.
                </p>
              </div>
            </div>

            <div className="relative flex items-center justify-between gap-3 sm:justify-end">
              <div className="hidden items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 ring-1 ring-sky-100 sm:flex">
                <FileText size={15} />
                <span>PDF + reportes</span>
              </div>
              <div className="hidden items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 ring-1 ring-violet-100 md:flex">
                <LineChart size={15} />
                <span>Progreso</span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100 transition-all group-hover:translate-x-1 group-hover:bg-sky-600 group-hover:text-white">
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}
