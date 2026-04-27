import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { Books, SquaresFour, ChatsCircle, Headphones, Cube, ShoppingBag, CalendarBlank } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React from 'react'
import useSWR from 'swr'
import { useTranslation } from 'react-i18next'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getOrgPlaygrounds } from '@services/playgrounds/playgrounds'

function MenuLinks(props: {
  orgslug: string
  primaryColor?: string
  variant?: 'desktop' | 'mobile'
  onNavigate?: () => void
}) {
  const org = useOrg() as any
  const isMobile = props.variant === 'mobile'
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const { isAdmin } = useAdminStatus()

  // Feature visibility: resolved_features from API is the source of truth
  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const isCoursesEnabled = isEnabled('courses')
  const isCollectionsEnabled = isEnabled('collections')
  const showCommunities = isEnabled('communities')
  const showPodcasts = isEnabled('podcasts')
  const showPlaygrounds = isEnabled('playgrounds')
  const showStore = isEnabled('payments')
  const { data: accessiblePlaygrounds } = useSWR(
    showPlaygrounds && org?.id && isAdmin !== true
      ? ['org-menu-playgrounds', org.id, accessToken || 'anonymous']
      : null,
    () => getOrgPlaygrounds(org.id, accessToken ?? undefined),
    { revalidateOnFocus: false }
  )
  const showPlaygroundsLink =
    showPlaygrounds && (isAdmin === true || (accessiblePlaygrounds?.length || 0) > 0)

  return (
    <div className={isMobile ? 'w-full' : 'pl-1'}>
      <ul className={isMobile ? 'flex w-full flex-col gap-1' : 'flex space-x-5'}>
        {isCoursesEnabled && (
          <LinkItem
            link="/courses"
            type="courses"
            orgslug={props.orgslug}
            primaryColor={props.primaryColor}
            variant={props.variant}
            onNavigate={props.onNavigate}
          ></LinkItem>
        )}
        {isCollectionsEnabled && (
          <LinkItem
            link="/collections"
            type="collections"
            orgslug={props.orgslug}
            primaryColor={props.primaryColor}
            variant={props.variant}
            onNavigate={props.onNavigate}
          ></LinkItem>
        )}
        {showPodcasts && (
          <LinkItem
            link="/podcasts"
            type="podcasts"
            orgslug={props.orgslug}
            primaryColor={props.primaryColor}
            variant={props.variant}
            onNavigate={props.onNavigate}
          ></LinkItem>
        )}
        {showCommunities && (
          <LinkItem
            link="/communities"
            type="communities"
            orgslug={props.orgslug}
            primaryColor={props.primaryColor}
            variant={props.variant}
            onNavigate={props.onNavigate}
          ></LinkItem>
        )}
        {showPlaygroundsLink && (
          <LinkItem
            link="/playgrounds"
            type="playgrounds"
            orgslug={props.orgslug}
            primaryColor={props.primaryColor}
            variant={props.variant}
            onNavigate={props.onNavigate}
          ></LinkItem>
        )}
        <LinkItem
          link="/schedule"
          type="schedule"
          orgslug={props.orgslug}
          primaryColor={props.primaryColor}
          variant={props.variant}
          onNavigate={props.onNavigate}
        ></LinkItem>
        {showStore && (
          <LinkItem
            link="/store"
            type="store"
            orgslug={props.orgslug}
            primaryColor={props.primaryColor}
            variant={props.variant}
            onNavigate={props.onNavigate}
          ></LinkItem>
        )}
      </ul>
    </div>
  )
}
const LinkItem = (props: any) => {
  const { t } = useTranslation()
  const router = useRouter()
  const [isPressed, setIsPressed] = React.useState(false)
  const link = props.link
  const orgslug = props.orgslug
  const colors = getMenuColorClasses(props.primaryColor || '')
  const textColorClass = colors.text
  const isMobile = props.variant === 'mobile'
  const href = getUriWithOrg(orgslug, link)
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isMobile) {
      props.onNavigate?.()
      return
    }

    event.preventDefault()
    if (isPressed) return

    setIsPressed(true)
    window.setTimeout(() => {
      props.onNavigate?.()
      router.push(href)
    }, 220)
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={isMobile ? 'block w-full' : 'block'}
    >
      <li
        className={`flex items-center gap-3 ${textColorClass} font-semibold transition-all duration-150 ease-out active:scale-[0.98] ${
          isMobile
            ? `w-full rounded-lg px-3 py-2 text-sm hover:bg-gray-100 active:bg-gray-200 ${isPressed ? 'scale-[0.98] bg-gray-200 shadow-inner' : ''}`
            : 'rounded-md px-1 py-1 hover:bg-black/5'
        }`}
      >
        {props.type == 'courses' && (
          <>
            <Books size={20} weight="fill" />{' '}
            <span>{t('courses.courses')}</span>
          </>
        )}

        {props.type == 'collections' && (
          <>
            <SquaresFour size={20} weight="fill" />{' '}
            <span>{t('collections.collections')}</span>
          </>
        )}

        {props.type == 'podcasts' && (
          <>
            <Headphones size={20} weight="fill" />{' '}
            <span>{t('podcasts.podcasts')}</span>
          </>
        )}

        {props.type == 'communities' && (
          <>
            <ChatsCircle size={20} weight="fill" />{' '}
            <span>{t('communities.title')}</span>
          </>
        )}

        {props.type == 'playgrounds' && (
          <>
            <Cube size={20} weight="fill" />{' '}
            <span>Playgrounds</span>
          </>
        )}

        {props.type == 'store' && (
          <>
            <ShoppingBag size={20} weight="fill" />{' '}
            <span>Store</span>
          </>
        )}

        {props.type == 'schedule' && (
          <>
            <CalendarBlank size={20} weight="fill" />{' '}
            <span>{t('common.schedule')}</span>
          </>
        )}

      </li>
    </Link>
  )
}
export default MenuLinks
