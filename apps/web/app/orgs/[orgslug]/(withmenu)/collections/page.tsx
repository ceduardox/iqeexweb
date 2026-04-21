import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import { getServerSession } from '@/lib/auth/server'
import { getOrgCollections } from '@services/courses/collections'
import { getOrgThumbnailMediaDirectory } from '@services/media/media'
import CollectionsClient from './CollectionsClient'

type MetadataProps = {
  params: Promise<{ orgslug: string; courseid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  })

  return {
    title: `Programas - ${org.name}`,
    description: `Programas de cursos de ${org.name}`,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: `Programas - ${org.name}`,
      description: `Programas de cursos de ${org.name}`,
      type: 'website',
      images: [
        {
          url: getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image),
          width: 800,
          height: 600,
          alt: org.name,
        },
      ],
    },
  }
}

const CollectionsPage = async (params: any) => {
  const session = await getServerSession()
  const access_token = session?.tokens?.access_token
  const orgslug = (await params.params).orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })
  const org_id = org.id
  const collections = await getOrgCollections(
    org_id,
    access_token ?? undefined,
    { revalidate: 0, tags: ['collections'] }
  )

  return (
    <CollectionsClient
      collections={collections}
      orgslug={orgslug}
      org_id={org_id}
    />
  )
}

export default CollectionsPage
