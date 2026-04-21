'use client'

import React, { useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import toast from 'react-hot-toast'
import { ShieldCheck, UserPlus, RefreshCcw } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { Button } from '@components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table'
import { getOffers } from '@services/payments/offers'
import {
  createAdminEnrollment,
  getAdminEnrollments,
  updateAdminEnrollmentStatus,
} from '@services/payments/payments'
import { getOrganizationUsers } from '@services/organizations/orgs'

const ENROLLMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-gray-100 text-gray-600',
    failed: 'bg-red-100 text-red-600',
    refunded: 'bg-purple-100 text-purple-700',
  }

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function SourcePill({ source }: { source: string }) {
  const isManual = source === 'admin_manual'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isManual ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
      {isManual ? 'Manual' : 'Store'}
    </span>
  )
}

export default function PaymentsManualAccessPage() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { rights } = useAdminStatus()
  const access_token = session?.data?.tokens?.access_token

  const canManageManualAccess =
    session?.data?.user?.is_superadmin === true ||
    rights?.organizations?.action_update === true

  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedOfferId, setSelectedOfferId] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({})
  const [pendingUpdateId, setPendingUpdateId] = useState<number | null>(null)

  const enrollmentsKey = org?.id && access_token
    ? [`/payments/${org.id}/enrollments/admin`, access_token]
    : null

  const { data: enrollments, isLoading: enrollmentsLoading } = useSWR(
    enrollmentsKey,
    () => getAdminEnrollments(org.id, access_token)
  )

  const { data: offersResult, isLoading: offersLoading } = useSWR(
    org?.id && access_token ? [`/payments/${org.id}/offers`, access_token] : null,
    () => getOffers(org.id, access_token)
  )

  const { data: usersResult, isLoading: usersLoading } = useSWR(
    org?.id && access_token ? [`/orgs/${org.id}/users`, access_token] : null,
    () => getOrganizationUsers(org.id, access_token, { page: 1, limit: 100 })
  )

  const offerOptions = useMemo(() => {
    if (!Array.isArray(offersResult?.data)) return []
    return offersResult.data
  }, [offersResult])

  const userOptions = useMemo(() => {
    const items = usersResult?.data?.items
    return Array.isArray(items) ? items : []
  }, [usersResult])

  const enrollmentItems = Array.isArray(enrollments) ? enrollments : []

  const handleCreate = async () => {
    if (!selectedUserId || !selectedOfferId) {
      toast.error('Select a user and an offer')
      return
    }

    setIsSubmitting(true)
    try {
      await createAdminEnrollment(
        org.id,
        {
          user_id: Number(selectedUserId),
          offer_id: Number(selectedOfferId),
          status: selectedStatus,
        },
        access_token
      )
      toast.success('Manual access assigned')
      setSelectedUserId('')
      setSelectedOfferId('')
      setSelectedStatus('active')
      if (enrollmentsKey) {
        mutate(enrollmentsKey)
      }
    } catch (error: any) {
      toast.error(error?.detail || error?.message || 'Could not assign access')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusUpdate = async (enrollmentId: number) => {
    const nextStatus = statusDrafts[enrollmentId]
    if (!nextStatus) return

    setPendingUpdateId(enrollmentId)
    try {
      await updateAdminEnrollmentStatus(org.id, enrollmentId, nextStatus, access_token)
      toast.success('Enrollment updated')
      if (enrollmentsKey) {
        mutate(enrollmentsKey)
      }
    } catch (error: any) {
      toast.error(error?.detail || error?.message || 'Could not update enrollment')
    } finally {
      setPendingUpdateId(null)
    }
  }

  if (!canManageManualAccess) {
    return (
      <div className="ml-10 mr-10 mx-auto bg-white rounded-xl border border-gray-200 px-6 py-10 text-center">
        <ShieldCheck size={24} className="mx-auto text-gray-400 mb-3" />
        <p className="text-base font-semibold text-gray-800">Only organization admins can manage manual access</p>
        <p className="text-sm text-gray-500 mt-1">Teachers can keep using the platform, but they will not see or control paid access assignments.</p>
      </div>
    )
  }

  if (enrollmentsLoading || offersLoading || usersLoading) {
    return <PageLoading />
  }

  return (
    <div className="ml-10 mr-10 mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <UserPlus size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Manual Access</h2>
            <p className="text-sm text-gray-500 mt-1">
              Assign paid offers manually to learners while keeping the store checkout flow active.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">User</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
            >
              <option value="">Select user</option>
              {userOptions.map((item: any) => (
                <option key={item.user.id} value={item.user.id}>
                  {item.user.first_name || item.user.last_name
                    ? `${item.user.first_name ?? ''} ${item.user.last_name ?? ''}`.trim()
                    : item.user.username}{' '}
                  - {item.user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</label>
            <select
              value={selectedOfferId}
              onChange={(e) => setSelectedOfferId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
            >
              <option value="">Select offer</option>
              {offerOptions.map((offer: any) => (
                <option key={offer.id} value={offer.id}>
                  {offer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Initial status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
            >
              {ENROLLMENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Assigning...' : 'Assign access'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Enrollments</h3>
            <p className="text-sm text-gray-500">Store purchases and manual assignments in one place.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (enrollmentsKey) {
                mutate(enrollmentsKey)
              }
            }}
          >
            <RefreshCcw size={14} className="mr-1.5" />
            Refresh
          </Button>
        </div>

        {enrollmentItems.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No enrollments yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Update status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollmentItems.map((item: any) => {
                const currentDraft = statusDrafts[item.enrollment_id] ?? item.status
                return (
                  <TableRow key={item.enrollment_id}>
                    <TableCell>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-900">
                          {item.user.first_name || item.user.last_name
                            ? `${item.user.first_name ?? ''} ${item.user.last_name ?? ''}`.trim()
                            : item.user.username}
                        </span>
                        <span className="text-xs text-gray-400 truncate">{item.user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-900">{item.offer.name}</span>
                        <span className="text-xs text-gray-400 capitalize">{item.offer.offer_type?.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <SourcePill source={item.source} />
                    </TableCell>
                    <TableCell>
                      <StatusPill status={item.status} />
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(item.creation_date).toLocaleDateString('en-US')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <select
                          value={currentDraft}
                          onChange={(e) =>
                            setStatusDrafts((prev) => ({
                              ...prev,
                              [item.enrollment_id]: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
                        >
                          {ENROLLMENT_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingUpdateId === item.enrollment_id || currentDraft === item.status}
                          onClick={() => handleStatusUpdate(item.enrollment_id)}
                        >
                          {pendingUpdateId === item.enrollment_id ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
