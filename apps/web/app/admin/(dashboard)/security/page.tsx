import React from 'react'
import type { Metadata } from 'next'
import AccessLockSettings from '@components/Admin/AccessLockSettings'

export const metadata: Metadata = {
  title: 'Access Lock',
}

export default function AdminSecurityPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Access Lock</h1>
        <p className="text-white/40 mt-1">
          Control who can see the site while it is not ready for public access.
        </p>
      </div>
      <AccessLockSettings />
    </div>
  )
}
