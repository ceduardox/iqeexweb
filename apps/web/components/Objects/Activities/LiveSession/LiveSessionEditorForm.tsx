'use client'

import React, { useState } from 'react'
import * as Form from '@radix-ui/react-form'
import { BarLoader } from 'react-spinners'

import FormLayout, {
  ButtonBlack,
  Flex,
  FormField,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form'
import {
  DEFAULT_LIVE_SESSION_DURATION,
  LiveSessionDetails,
  buildLiveSessionDetails,
  isLiveSessionDetails,
  toDateTimeLocalValue,
} from './liveSessionUtils'
import { useTranslation } from 'react-i18next'

interface LiveSessionEditorFormProps {
  initialName?: string
  initialDetails?: any
  submitLabel: string
  onSubmit: (payload: { name: string; details: LiveSessionDetails }) => Promise<void>
}

export default function LiveSessionEditorForm({
  initialName = '',
  initialDetails,
  submitLabel,
  onSubmit,
}: LiveSessionEditorFormProps) {
  const { t } = useTranslation()
  const liveDetails = isLiveSessionDetails(initialDetails) ? initialDetails : null

  const [activityName, setActivityName] = useState(initialName)
  const [description, setDescription] = useState(liveDetails?.description || '')
  const [scheduledStart, setScheduledStart] = useState(
    toDateTimeLocalValue(liveDetails?.scheduled_start)
  )
  const [durationMinutes, setDurationMinutes] = useState(
    String(liveDetails?.duration_minutes || DEFAULT_LIVE_SESSION_DURATION)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activityName.trim() || !scheduledStart) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: activityName.trim(),
        details: buildLiveSessionDetails(
          {
            activityName: activityName.trim(),
            description,
            scheduledStart,
            durationMinutes: Number(durationMinutes) || DEFAULT_LIVE_SESSION_DURATION,
          },
          initialDetails
        ),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormLayout onSubmit={handleSubmit}>
      <FormField name="live-session-activity-name">
        <Flex className="items-baseline justify-between">
          <FormLabel>
            {t('activities.activity_name', { defaultValue: 'Activity name' })}
          </FormLabel>
          <FormMessage match="valueMissing">
            {t('activities.activity_name_required', {
              defaultValue: 'Please provide a name for this live session',
            })}
          </FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            value={activityName}
            onChange={(event) => setActivityName(event.target.value)}
            type="text"
            required
          />
        </Form.Control>
      </FormField>

      <FormField name="live-session-description">
        <Flex className="items-baseline justify-between">
          <FormLabel>
            {t('activities.description', { defaultValue: 'Description' })}
          </FormLabel>
        </Flex>
        <Form.Control asChild>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Form.Control>
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField name="live-session-scheduled-start">
          <Flex className="items-baseline justify-between">
            <FormLabel>
              {t('activities.live_session_start', {
                defaultValue: 'Start date and time',
              })}
            </FormLabel>
            <FormMessage match="valueMissing">
              {t('activities.live_session_start_required', {
                defaultValue: 'Please set the start date and time',
              })}
            </FormMessage>
          </Flex>
          <Form.Control asChild>
            <Input
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
              type="datetime-local"
              required
            />
          </Form.Control>
        </FormField>

        <FormField name="live-session-duration">
          <Flex className="items-baseline justify-between">
            <FormLabel>
              {t('activities.live_session_duration', {
                defaultValue: 'Duration in minutes',
              })}
            </FormLabel>
          </Flex>
          <Form.Control asChild>
            <Input
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              type="number"
              min="15"
              step="5"
              required
            />
          </Form.Control>
        </FormField>
      </div>

      <p className="text-xs text-gray-500">
        {t('activities.live_session_helper', {
          defaultValue:
            'The room stays inside this course activity. Chat and screen sharing are handled inside the live room.',
        })}
      </p>

      <Flex className="mt-6 justify-end">
        <Form.Submit asChild>
          <ButtonBlack type="submit" className="mt-2.5">
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              submitLabel
            )}
          </ButtonBlack>
        </Form.Submit>
      </Flex>
    </FormLayout>
  )
}
