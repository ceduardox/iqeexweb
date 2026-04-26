import { Metadata } from 'next'
import { getServerSession } from '@/lib/auth/server'
import { getPlayground } from '@services/playgrounds/playgrounds'
import { getOrgCourses } from '@services/courses/courses'
import { notFound, redirect } from 'next/navigation'
import PlaygroundEditor from '@components/Playground/PlaygroundEditor'

type PageParams = Promise<{ playgrounduuid: string }>

function canEditPlayground(session: any, playground: any): boolean {
  if (session?.user?.is_superadmin === true) return true

  const currentUserId = Number(session?.user?.id || 0)
  const isOwner = currentUserId > 0 && Number(playground?.created_by) === currentUserId
  const orgId = Number(playground?.org_id || 0)
  const roles = Array.isArray(session?.roles) ? session.roles : []
  return roles.some((role: any) => {
    if (Number(role?.org?.id) !== orgId) return false
    const playgroundRights = role?.role?.rights?.playgrounds
    return (
      playgroundRights?.action_update === true ||
      (isOwner && playgroundRights?.action_update_own === true)
    )
  })
}

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { playgrounduuid } = await params
  try {
    const pg = await getPlayground(playgrounduuid)
    return { title: `Edit — ${pg.name}` }
  } catch {
    return { title: 'Edit Playground' }
  }
}

export default async function EditPlaygroundPage({ params }: { params: PageParams }) {
  const { playgrounduuid } = await params
  const session = await getServerSession()
  const access_token = session?.tokens?.access_token

  if (!access_token) {
    redirect('/auth/login')
  }

  let playground
  try {
    playground = await getPlayground(playgrounduuid, access_token)
  } catch {
    notFound()
  }

  if (!canEditPlayground(session, playground)) {
    notFound()
  }

  let orgCourses: { course_uuid: string; name: string }[] = []
  if (playground.org_slug) {
    try {
      const coursesRes = await getOrgCourses(playground.org_slug, null, access_token, true)
      orgCourses = (Array.isArray(coursesRes) ? coursesRes : []).map((c: any) => ({
        course_uuid: c.course_uuid,
        name: c.name,
      }))
    } catch {
      // Non-fatal — proceed without course context
    }
  }

  return (
    <PlaygroundEditor
      playground={playground}
      orgslug={playground.org_slug || ''}
      accessToken={access_token}
      orgCourses={orgCourses}
    />
  )
}
