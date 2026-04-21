'use client'

import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useOrg } from '@components/Contexts/OrgContext'

const CollectionClient = ({
  orgslug,
  collection,
}: {
  orgslug: string
  collection: any | null
}) => {
  const { t } = useTranslation()
  const org = useOrg() as any

  const removeCoursePrefix = (courseid: string) => {
    return courseid.replace('course_', '')
  }

  if (!collection) {
    return (
      <GeneralWrapperStyled>
        <h2 className="text-sm font-bold text-gray-400">{t('collections.collection')}</h2>
        <h1 className="text-3xl font-bold">{t('common.not_found') || 'No disponible'}</h1>
        <p className="mt-3 text-gray-500">
          No tienes acceso a este programa o ya no existe.
        </p>
      </GeneralWrapperStyled>
    )
  }

  return (
    <GeneralWrapperStyled>
      <h2 className="text-sm font-bold text-gray-400">{t('collections.collection')}</h2>
      <h1 className="text-3xl font-bold">{collection.name}</h1>
      <br />
      <div className="home_courses flex flex-wrap">
        {collection.courses.map((course: any) => (
          <div className="pr-8" key={course.course_uuid}>
            <Link
              href={getUriWithOrg(
                orgslug,
                '/course/' + removeCoursePrefix(course.course_uuid)
              )}
            >
              <div
                className="inset-0 ring-1 ring-inset ring-black/10 rounded-lg shadow-xl relative w-[249px] h-[131px] bg-cover"
                style={{
                  backgroundImage: `url(${course.thumbnail_image
                    ? getCourseThumbnailMediaDirectory(
                        org.org_uuid,
                        course.course_uuid,
                        course.thumbnail_image
                      )
                    : '/empty_thumbnail.png'
                  })`,
                }}
              ></div>
            </Link>
            <h2 className="font-bold text-lg w-[250px] py-2">{course.name}</h2>
          </div>
        ))}
      </div>
    </GeneralWrapperStyled>
  )
}

export default CollectionClient
