'use client'

import React, { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { LockKey, ShieldCheck, WarningCircle } from '@phosphor-icons/react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'

type AccessLockConfig = {
  enabled: boolean
  allowed_ips: string[]
  current_ip?: string
}

function parseIpList(value: string): string[] {
  return value
    .replace(/,/g, '\n')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function AccessLockSettings() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const url = `${getAPIUrl()}ee/superadmin/access-lock`
  const { data, error, mutate, isLoading } = useSWR<AccessLockConfig>(
    accessToken ? url : null,
    (requestUrl: string) => swrFetcher(requestUrl, accessToken)
  )
  const [enabled, setEnabled] = useState(false)
  const [ipText, setIpText] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!data) return
    setEnabled(Boolean(data.enabled))
    setIpText((data.allowed_ips || []).join('\n'))
  }, [data])

  const allowedIps = useMemo(() => parseIpList(ipText), [ipText])
  const canSave = !saving && !!accessToken && (!enabled || allowedIps.length > 0)

  async function saveSettings() {
    if (!canSave) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          allowed_ips: allowedIps,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail || 'Could not save access lock settings')
      }

      await mutate()
      setMessage('Configuracion guardada. El proxy puede tardar hasta 15 segundos en aplicar el cambio.')
    } catch (err: any) {
      setMessage(err?.message || 'No se pudo guardar la configuracion.')
    } finally {
      setSaving(false)
    }
  }

  function addCurrentIp() {
    const currentIp = data?.current_ip?.trim()
    if (!currentIp) return
    const next = new Set([...allowedIps, currentIp])
    setIpText(Array.from(next).join('\n'))
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#171719] shadow-2xl shadow-black/20">
        <div className={`h-1 ${enabled ? 'bg-gradient-to-r from-amber-500 via-red-500 to-fuchsia-500' : 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500'}`} />
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${enabled ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                <LockKey size={22} weight="fill" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Bloqueo global por IP</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-white/45">
                  Si esta activo, cualquier pagina web responde vacia para IPs no permitidas. Desactivalo para que todos puedan ver la plataforma.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEnabled((value) => !value)}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                enabled
                  ? 'bg-amber-500 text-black hover:bg-amber-400'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              {enabled ? 'Activo' : 'Desactivado'}
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-lg border border-white/[0.08] bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Tu IP detectada</p>
                  <p className="mt-1 font-mono text-sm text-white/50">
                    {data?.current_ip || (isLoading ? 'Detectando...' : 'No disponible')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCurrentIp}
                  disabled={!data?.current_ip}
                  className="rounded-lg border border-white/[0.1] px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Agregar mi IP
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-white">IPs permitidas</span>
              <textarea
                value={ipText}
                onChange={(event) => setIpText(event.target.value)}
                placeholder={'Ejemplo:\n190.129.12.34\n200.87.0.0/16'}
                rows={7}
                className="mt-2 w-full resize-y rounded-lg border border-white/[0.08] bg-black/25 px-3 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-indigo-400/60"
              />
            </label>

            {enabled && allowedIps.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
                Agrega al menos una IP antes de activar el bloqueo.
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
                No se pudo cargar la configuracion.
              </div>
            )}

            {message && (
              <div className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 text-sm text-white/65">
                <ShieldCheck size={18} weight="fill" className="mt-0.5 shrink-0 text-emerald-300" />
                {message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveSettings}
                disabled={!canSave}
                className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:-translate-y-0.5 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#171719] p-5">
        <h3 className="text-sm font-semibold text-white">Recomendacion operativa</h3>
        <p className="mt-2 text-sm leading-6 text-white/45">
          Antes de activarlo, agrega tu IP actual y cualquier IP del equipo que necesite probar. Si cambias de red, podrias quedar fuera hasta entrar desde una IP permitida o desactivarlo desde base de datos.
        </p>
      </div>
    </div>
  )
}
