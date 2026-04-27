import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import ScheduleModule from '@components/Schedule/ScheduleModule'

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
    title: 'Agenda - ' + org.name,
    robots: {
      index: false,
      follow: false,
    },
  }
}

async function DashboardSchedulePage(params: any) {
  const orgslug = (await params.params).orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })

  return <ScheduleModule orgId={org.id} orgslug={orgslug} dashboard />
}

export default DashboardSchedulePage
