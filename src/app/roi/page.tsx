import { DashboardLayout } from '@/components/dashboard-layout'
import { RoiCanvas } from './roi-canvas'
import { getRoiConfig } from './actions'

export default async function RoiPage() {
  const streamUrl = process.env.NEXT_PUBLIC_PYTHON_STREAM_URL || "http://localhost:8000"

  // Fetch coordinates from Supabase
  const roiConfig = await getRoiConfig()
  const initialPoints = roiConfig?.roi_points || []

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5 w-full px-1 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Dynamic ROI & Pos Kerja
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-3xl">
              Tentukan batas wilayah utama <strong className="text-foreground font-semibold font-medium">Pos Kerja</strong> pegawai dapur. AI akan mendeteksi presensi pegawai di dalam area poligon ini dan memicu alarm peringatan sirene dapur jika pos kosong lebih dari 5 detik.
            </p>
          </div>
        </div>

        <RoiCanvas
          initialPoints={initialPoints}
          streamUrl={streamUrl}
        />
      </div>
    </DashboardLayout>
  )
}
