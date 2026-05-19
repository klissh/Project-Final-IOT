import { createClient } from '@/utils/supabase/server'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogTable } from './log-table'

export default async function LogsPage() {
  const supabase = await createClient()

  // Fetch all violations
  const { data: violations } = await supabase
    .from('violations')
    .select('*')
    .order('timestamp', { ascending: false })

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Log Pelanggaran</h2>
          <p className="text-zinc-400 mt-1">Daftar lengkap riwayat pelanggaran kebersihan dan keamanan.</p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Riwayat Terkini</CardTitle>
          </CardHeader>
          <CardContent>
            <LogTable initialViolations={violations || []} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
