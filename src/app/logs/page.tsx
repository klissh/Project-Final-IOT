import { createClient } from '@/utils/supabase/server'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { LogTable } from './log-table'
import Link from 'next/link'

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; page?: string }> | { range?: string; page?: string }
}) {
  const supabase = await createClient()

  // Parse filters
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const activeRange = resolvedParams?.range ?? 'all'
  const currentPage = parseInt(resolvedParams?.page ?? '1')
  const limit = 10

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let startDate: Date | null = null
  let endDate: Date | null = null

  if (activeRange === 'today') {
    startDate = todayStart
  } else if (activeRange === 'yesterday') {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    startDate = new Date(yesterday)
    startDate.setHours(0, 0, 0, 0)
    
    endDate = new Date(yesterday)
    endDate.setHours(23, 59, 59, 999)
  } else if (activeRange === '7d') {
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)
  } else if (activeRange === '30d') {
    startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    startDate.setHours(0, 0, 0, 0)
  }

  // Count total matches for pagination
  let countQuery = supabase
    .from('violations')
    .select('*', { count: 'exact', head: true })

  let dataQuery = supabase
    .from('violations')
    .select('*')
    .order('timestamp', { ascending: false })

  if (startDate) {
    countQuery = countQuery.gte('timestamp', startDate.toISOString())
    dataQuery = dataQuery.gte('timestamp', startDate.toISOString())
  }
  if (endDate) {
    countQuery = countQuery.lte('timestamp', endDate.toISOString())
    dataQuery = dataQuery.lte('timestamp', endDate.toISOString())
  }

  const { count } = await countQuery
  const totalItems = count ?? 0
  const totalPages = Math.ceil(totalItems / limit)

  // Get paginated slice
  const from = (currentPage - 1) * limit
  const to = from + limit - 1
  const { data: violations } = await dataQuery.range(from, to)

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 w-full px-1">
        {/* Simple Page Header & Range Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border/40">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Log Pelanggaran
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daftar lengkap riwayat pelanggaran kebersihan dan keamanan (hygiene & safety).
            </p>
          </div>
          
          <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-lg border border-border/40 w-fit shrink-0 self-start sm:self-auto">
            {[
              { key: 'all', label: 'Semua' },
              { key: 'today', label: 'Hari Ini' },
              { key: 'yesterday', label: 'Kemarin' },
              { key: '7d', label: '7 Hari' },
              { key: '30d', label: '30 Hari' },
            ].map(tr => {
              const isSelected = activeRange === tr.key
              return (
                <Link
                  key={tr.key}
                  href={`/logs?range=${tr.key}`}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    isSelected
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tr.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Main Logs Table Card */}
        <Card className="p-0 border-border bg-card shadow-none w-full">
          <CardContent className="p-5">
            <LogTable
              initialViolations={violations || []}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              activeRange={activeRange}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
