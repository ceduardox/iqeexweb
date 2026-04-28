import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import ReadingTestModule from '@components/ReadingTest/ReadingTestModule'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })

  return {
    title: 'Test de lectura - ' + org.name,
    robots: {
      index: false,
      follow: false,
    },
  }
}

async function DashboardReadingTestPage(params: any) {
  const orgslug = (await params.params).orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })

  return <ReadingTestModule orgId={org.id} dashboard />
}

export default DashboardReadingTestPage
