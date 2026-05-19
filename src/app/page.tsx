import { createClient } from '@/utils/supabase/server'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Cpu, Server, BellRing, Activity, Camera, Crop, List, Settings } from 'lucide-react'
import Link from 'next/link'

const violationLabel: Record<string, string> = {
  no_both: 'No Mask & Hairnet',
  no_mask: 'No Mask',
  no_hairnet: 'No Hairnet',
  left_post: 'Left Station',
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }> | { range?: string }
}) {
  const supabase = await createClient()

  // Parse activeRange from searchParams
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams
  const activeRange = resolvedParams?.range ?? 'today'

  // Fetch system settings
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('*')
    .single()

  const aiActive = settingsData?.ai_detection_active ?? true
  const buzzerActive = settingsData?.buzzer_enabled ?? true
  const telegramActive = settingsData?.telegram_enabled ?? true
  const logEnabled = settingsData?.log_enabled ?? true
  const thresholdPct = settingsData ? Math.round(settingsData.confidence_threshold * 100) : 40
  const emptyPostTimer = settingsData?.empty_post_timer ?? 5

  // Get violations in the last hour (always today)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const { count: lastHourCount } = await supabase
    .from('violations')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', oneHourAgo.toISOString())

  // Define date limits based on activeRange
  const now = new Date()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  
  let startDate = new Date()
  let endDate: Date | null = null

  if (activeRange === 'yesterday') {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    startDate = new Date(yesterday)
    startDate.setHours(0, 0, 0, 0)
    
    endDate = new Date(yesterday)
    endDate.setHours(23, 59, 59, 999)
  } else if (activeRange === '7d') {
    startDate.setDate(startDate.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)
  } else if (activeRange === '30d') {
    startDate.setDate(startDate.getDate() - 30)
    startDate.setHours(0, 0, 0, 0)
  } else {
    // Default: 'today'
    startDate.setHours(0, 0, 0, 0)
  }

  // Fetch all violations for the selected range in one query
  let rangeQuery = supabase
    .from('violations')
    .select('timestamp, violation_type, confidence, status, id')
    .gte('timestamp', startDate.toISOString())
    .order('timestamp', { ascending: false })

  if (endDate) {
    rangeQuery = rangeQuery.lte('timestamp', endDate.toISOString())
  }

  const { data: rangeViolations } = await rangeQuery
  const totalViolationsCount = rangeViolations?.length ?? 0
  const recentViolations = rangeViolations ? rangeViolations.slice(0, 5) : []

  const metricCards = [
    {
      label: 'AI CAMERA',
      value: aiActive ? 'Active' : 'Inactive',
      sub: 'Hygiene detection engine',
      statusLabel: aiActive ? 'Running' : 'Stopped',
      active: aiActive,
      icon: Cpu,
      colorClass: 'text-blue-500',
      badgeClass: aiActive
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50',
    },
    {
      label: 'ESP32 BUZZER',
      value: buzzerActive ? 'Active' : 'Inactive',
      sub: 'Hardware alarm system',
      statusLabel: buzzerActive ? 'Connected' : 'Offline',
      active: buzzerActive,
      icon: Server,
      colorClass: 'text-amber-500',
      badgeClass: buzzerActive
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50',
    },
    {
      label: 'TELEGRAM BOT',
      value: telegramActive && logEnabled ? 'Active' : 'Inactive',
      sub: 'Mobile notifications',
      statusLabel: telegramActive && logEnabled ? 'Enabled' : 'Disabled',
      active: telegramActive && logEnabled,
      icon: BellRing,
      colorClass: 'text-emerald-500',
      badgeClass: telegramActive && logEnabled
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50',
    },
    {
      label: 'TOTAL VIOLATIONS',
      value: totalViolationsCount.toString(),
      sub: activeRange === 'today'
        ? 'Logged today'
        : activeRange === 'yesterday'
        ? 'Logged yesterday'
        : activeRange === '7d'
        ? 'Last 7 days'
        : 'Last 30 days',
      statusLabel: activeRange === 'today'
        ? `+${lastHourCount ?? 0} last hour`
        : activeRange === 'yesterday'
        ? `Total yesterday`
        : activeRange === '7d'
        ? `Avg ${Math.round(totalViolationsCount / 7)} / day`
        : `Avg ${Math.round(totalViolationsCount / 30)} / day`,
      active: activeRange === 'today' ? (lastHourCount ? lastHourCount > 0 : false) : totalViolationsCount > 0,
      icon: Activity,
      colorClass: 'text-rose-500',
      badgeClass: (activeRange === 'today' ? lastHourCount && lastHourCount > 0 : totalViolationsCount > 0)
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50',
    },
  ]

  // Calculate dynamic hourly activity from Supabase data
  const hourlyCounts: Record<string, number> = {}
  const hoursToDisplay = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17']
  hoursToDisplay.forEach(h => {
    hourlyCounts[h] = 0
  })

  if (rangeViolations) {
    rangeViolations.forEach(v => {
      const date = new Date(v.timestamp)
      const hr = date.getHours().toString().padStart(2, '0')
      if (hr in hourlyCounts) {
        hourlyCounts[hr]++
      }
    })
  }

  const maxCount = Math.max(...Object.values(hourlyCounts), 1)
  const currentHourStr = new Date().getHours().toString().padStart(2, '0')

  const hourlyActivity = hoursToDisplay.map(h => {
    const count = hourlyCounts[h]
    // Scale height relative to the max hourly count (minimum 8% height if count > 0)
    const pct = count > 0 ? Math.max(8, Math.round((count / maxCount) * 100)) : 0
    return {
      hour: h,
      count,
      height: `${pct}%`,
      active: activeRange === 'today' && h === currentHourStr
    }
  })

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full px-1">

        {/* Dashboard Header & Time Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Overview</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Kitchen hygiene AIoT surveillance overview</p>
          </div>
          
          <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-lg border border-border/40 w-fit shrink-0 self-start sm:self-auto">
            {[
              { key: 'today', label: 'Hari Ini' },
              { key: 'yesterday', label: 'Kemarin' },
              { key: '7d', label: '7 Hari' },
              { key: '30d', label: '30 Hari' },
            ].map(tr => {
              const isSelected = activeRange === tr.key
              return (
                <Link
                  key={tr.key}
                  href={`/?range=${tr.key}`}
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

        {/* 4 Metrics Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map(({ label, value, sub, statusLabel, icon: Icon, colorClass, badgeClass }) => (
            <Card key={label} className="border-border bg-card shadow-none hover:border-border/80 transition-all">
              <CardContent className="p-5 flex flex-col justify-between h-[135px]">
                <div className="flex items-start justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest font-mono">
                    {label}
                  </p>
                  <Icon className="h-4 w-4 text-muted-foreground/45 shrink-0" />
                </div>
                <div className="my-2">
                  <p className={`text-2xl font-semibold tracking-tight ${colorClass}`}>
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
                <div className="self-start">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase font-mono ${badgeClass}`}>
                    {statusLabel}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
          {/* Left Column: Recent Violations & Histogram (col-span-8) */}
          <div className="lg:col-span-8 flex flex-col gap-5 w-full">
            {/* Recent Violations Card */}
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {activeRange === 'today'
                        ? 'Recent Violations'
                        : activeRange === 'yesterday'
                        ? 'Yesterday Violations'
                        : activeRange === '7d'
                        ? 'Violations (Last 7 Days)'
                        : 'Violations (Last 30 Days)'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeRange === 'today'
                        ? 'Latest hygiene & safety alerts'
                        : activeRange === 'yesterday'
                        ? 'Hygiene & safety alerts from yesterday'
                        : `Hygiene & safety alerts from last ${activeRange}`}
                    </p>
                  </div>
                  <Link
                    href="/logs"
                    className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-mono uppercase tracking-wider"
                  >
                    View all
                  </Link>
                </div>

                {/* Table container */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 font-mono w-[18%]">
                          TIME
                        </th>
                        <th className="py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 font-mono w-[38%]">
                          TYPE
                        </th>
                        <th className="py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 font-mono w-[28%]">
                          CONFIDENCE
                        </th>
                        <th className="py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 font-mono w-[16%] text-center">
                          STATUS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(!recentViolations || recentViolations.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            No violations recorded today.
                          </td>
                        </tr>
                      ) : (
                        recentViolations.map((violation) => {
                          const isLeftStation = violation.violation_type === 'left_post'
                          const typeLabel = violationLabel[violation.violation_type] ?? violation.violation_type
                          const confPct = Math.round(violation.confidence * 100)

                          return (
                            <tr key={violation.id} className="hover:bg-muted/15 transition-colors">
                              {/* Time */}
                              <td className="py-3 font-mono text-xs text-muted-foreground/90">
                                {new Date(violation.timestamp).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>

                              {/* Styled Flat Badge Type */}
                              <td className="py-3">
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${isLeftStation
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  }`}>
                                  {typeLabel}
                                </span>
                              </td>

                              {/* Confidence Horizontal Progress Bar */}
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-3 w-full">
                                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-blue-500"
                                      style={{ width: `${confPct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-xs font-semibold text-muted-foreground shrink-0 w-8 text-right">
                                    {confPct}%
                                  </span>
                                </div>
                              </td>

                              {/* Status Badge */}
                              <td className="py-3 text-center">
                                <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase text-muted-foreground/80 font-mono bg-card">
                                  {violation.status === 'new' ? 'New' : violation.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Hourly Activity CSS Histogram */}
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <h3 className="text-base font-semibold text-foreground">Hourly Activity</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeRange === 'today'
                    ? 'Violations per hour — today'
                    : activeRange === 'yesterday'
                    ? 'Violations per hour — yesterday'
                    : activeRange === '7d'
                    ? 'Violations per hour — last 7 days'
                    : 'Violations per hour — last 30 days'}
                </p>

                {/* Custom Histogram Chart */}
                <div className="mt-8 flex flex-col justify-end">
                  {/* Histogram bars */}
                  <div className="flex items-end justify-between h-28 px-2 w-full gap-2 md:gap-3">
                    {hourlyActivity.map(({ hour, height, active }) => (
                      <div key={hour} className="flex-1 h-full flex flex-col justify-end items-center group">
                        {/* Bar */}
                        <div
                          className={`w-full rounded-t-sm transition-all duration-300 ${active
                            ? 'bg-foreground shadow-lg'
                            : 'bg-secondary hover:bg-muted-foreground/35'
                            }`}
                          style={{ height }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Horizontal axis border */}
                  <div className="h-px bg-border/80 w-full mt-2" />

                  {/* Axis labels */}
                  <div className="flex justify-between px-2 w-full mt-2 gap-2 md:gap-3">
                    {hourlyActivity.map(({ hour }) => (
                      <span key={hour} className="flex-1 text-center font-mono text-[9px] font-semibold text-muted-foreground/60 tracking-wider">
                        {hour}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: System Status, Quick Actions, Threshold (col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-5 w-full">
            {/* System Status Module List */}
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">System Status</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">All modules</p>
                  </div>
                  <Link
                    href="/settings"
                    className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors font-mono uppercase tracking-wider"
                  >
                    Configure
                  </Link>
                </div>

                {/* Module status list */}
                <div className="space-y-3.5 mt-5">
                  {[
                    { label: 'AI Detection', active: aiActive, icon: Cpu },
                    { label: 'ESP32 Buzzer', active: buzzerActive, icon: Server },
                    { label: 'Telegram Bot', active: telegramActive && logEnabled, icon: BellRing },
                    { label: 'Violation Log', active: logEnabled, icon: Activity },
                  ].map(({ label, active, icon: Icon }) => (
                    <div key={label} className="flex items-center justify-between border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        <span className="text-sm font-medium text-foreground">{label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {active ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions 2x2 Grid */}
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <h3 className="text-base font-semibold text-foreground mb-4">Quick Actions</h3>

                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/live"
                    className="flex flex-col items-start gap-2 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-secondary/40 transition-colors text-left"
                  >
                    <Camera className="h-4 w-4 text-muted-foreground/60" />
                    <span className="text-xs font-semibold text-foreground mt-1">Live Monitor</span>
                  </Link>

                  <Link
                    href="/roi"
                    className="flex flex-col items-start gap-2 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-secondary/40 transition-colors text-left"
                  >
                    <Crop className="h-4 w-4 text-muted-foreground/60" />
                    <span className="text-xs font-semibold text-foreground mt-1">Edit ROI</span>
                  </Link>

                  <Link
                    href="/logs"
                    className="flex flex-col items-start gap-2 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-secondary/40 transition-colors text-left"
                  >
                    <List className="h-4 w-4 text-muted-foreground/60" />
                    <span className="text-xs font-semibold text-foreground mt-1">View Logs</span>
                  </Link>

                  <Link
                    href="/settings"
                    className="flex flex-col items-start gap-2 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-secondary/40 transition-colors text-left"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground/60" />
                    <span className="text-xs font-semibold text-foreground mt-1">Settings</span>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* AI Threshold Slider & Info */}
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">AI Threshold</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Current sensitivity</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-xs text-muted-foreground/80 font-medium">Confidence Min.</span>
                    <span className="text-2xl font-bold font-mono text-foreground">{thresholdPct}%</span>
                  </div>

                  {/* Horizontal Sensitivity Track */}
                  <div className="space-y-2">
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${thresholdPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-semibold font-mono text-muted-foreground/60">
                      <span>10% Sensitive</span>
                      <span>90% Strict</span>
                    </div>
                  </div>

                  {/* Footer subtext box matching screenshot */}
                  <div className="mt-4 p-3 rounded-lg bg-muted/65 border border-border/30 text-[11px] leading-relaxed text-muted-foreground">
                    Empty post timer: <span className="font-semibold text-foreground">{emptyPostTimer}s</span> — alarm triggers after station is unoccupied.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}