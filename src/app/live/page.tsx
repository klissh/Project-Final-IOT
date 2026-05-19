import { DashboardLayout } from '@/components/dashboard-layout'
import { getSettings } from '@/app/settings/actions'
import { LiveMonitorClient } from './live-monitor-client'

export default async function LivePage() {
  const settings = await getSettings()

  return (
    <DashboardLayout>
      <LiveMonitorClient initialSettings={settings} />
    </DashboardLayout>
  )
}
