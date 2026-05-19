import { DashboardLayout } from '@/components/dashboard-layout'
import { getSettings } from './actions'
import SettingsForm from './settings-form'

export default async function SettingsPage() {
  const settings = await getSettings()

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Pengaturan Sistem</h2>
          <p className="text-zinc-400 mt-1">Konfigurasi operasional, AI Threshold, dan Perangkat Keras.</p>
        </div>

        <SettingsForm initialSettings={settings} />
      </div>
    </DashboardLayout>
  )
}
