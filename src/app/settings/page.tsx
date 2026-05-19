import { DashboardLayout } from '@/components/dashboard-layout'
import { getSettings } from './actions'
import SettingsForm from './settings-form'

export default async function SettingsPage() {
  const settings = await getSettings()

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full px-1">
        {/* Simple Page Header */}
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Pengaturan Sistem
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5">
            Konfigurasi operasional kamera AI, batas kepekaan threshold, sistem bel buzzer ESP32, dan bot Telegram.
          </p>
        </div>

        <div className="w-full">
          <SettingsForm initialSettings={settings} />
        </div>
      </div>
    </DashboardLayout>
  )
}
