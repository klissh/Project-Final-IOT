import { createClient } from '@/utils/supabase/server'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, BellRing, Cpu, Server } from 'lucide-react'

export default async function DashboardHome() {
  const supabase = await createClient()

  // Fetch recent violations
  const { data: recentViolations } = await supabase
    .from('violations')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5)

  // Ambil pengaturan sistem
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('*')
    .single()

  const aiActive = settingsData?.ai_detection_active ?? true
  const buzzerActive = settingsData?.buzzer_enabled ?? true
  const telegramActive = settingsData?.telegram_enabled ?? true
  const logEnabled = settingsData?.log_enabled ?? true

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Beranda Sistem</h2>
          <p className="text-zinc-400 mt-1">Ringkasan status *Smart Kitchen Hygiene Monitor* Anda.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Mesin AI (Kamera)</CardTitle>
              <Cpu className={`h-4 w-4 ${aiActive ? 'text-blue-500' : 'text-zinc-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${aiActive ? 'text-blue-400' : 'text-zinc-500'}`}>
                {aiActive ? 'Aktif' : 'Nonaktif'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Status pendeteksi kebersihan</p>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">ESP32 (Buzzer)</CardTitle>
              <Server className={`h-4 w-4 ${buzzerActive ? 'text-orange-500' : 'text-zinc-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${buzzerActive ? 'text-orange-400' : 'text-zinc-500'}`}>
                {buzzerActive ? 'Aktif' : 'Nonaktif'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Sistem peringatan suara otomatis</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Bot Telegram</CardTitle>
              <BellRing className={`h-4 w-4 ${telegramActive && logEnabled ? 'text-green-500' : 'text-zinc-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${telegramActive && logEnabled ? 'text-green-400' : 'text-zinc-500'}`}>
                {telegramActive && logEnabled ? 'Aktif' : 'Nonaktif'}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {!logEnabled ? 'Log DB dimatikan' : 'Peringatan ke gawai/HP'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Pelanggaran</CardTitle>
              <Activity className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-100">{recentViolations?.length ? '5+' : '0'}</div>
              <p className="text-xs text-zinc-500 mt-1">Peringatan yang masuk hari ini</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Pelanggaran Terakhir</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {recentViolations?.map((violation) => (
                  <div key={violation.id} className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none text-zinc-100">
                        {violation.violation_type === 'no_both' ? 'Tanpa Masker & Jaring' : violation.violation_type}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {new Date(violation.timestamp).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-zinc-100">
                      <Badge variant="outline" className="border-red-900/50 text-red-500 bg-red-500/10">
                        {(violation.confidence * 100).toFixed(0)}% Conf
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {(!recentViolations || recentViolations.length === 0) && (
                  <p className="text-zinc-500 text-sm">Belum ada data pelanggaran.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
