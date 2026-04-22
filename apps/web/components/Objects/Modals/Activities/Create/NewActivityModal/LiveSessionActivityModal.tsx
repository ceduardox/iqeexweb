'use client'

import React from 'react'

import LiveSessionEditorForm from '@components/Objects/Activities/LiveSession/LiveSessionEditorForm'
import { useTranslation } from 'react-i18next'

function LiveSessionActivityModal({ submitActivity, chapterId, course }: any) {
  const { t } = useTranslation()

  return (
    <LiveSessionEditorForm
      submitLabel={t('activities.create_live_session', {
        defaultValue: 'Create live session',
      })}
      onSubmit={async ({ name, details }) => {
        await submitActivity({
          name,
          chapter_id: chapterId,
          activity_type: 'TYPE_CUSTOM',
          activity_sub_type: 'SUBTYPE_CUSTOM',
          published_version: 1,
          version: 1,
          course_id: course?.id || course?.courseStructure?.id,
          details,
        })
      }}
    />
  )
}

export default LiveSessionActivityModal
