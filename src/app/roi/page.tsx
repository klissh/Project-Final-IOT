import { DashboardLayout } from '@/components/dashboard-layout'
import { RoiCanvas } from './roi-canvas'
import { getRoiConfig } from './actions'

export default async function RoiPage() {
  const streamUrl = process.env.NEXT_PUBLIC_PYTHON_STREAM_URL || "http://localhost:8000"

  const roiConfig = await getRoiConfig()
  let initialPolygons = roiConfig?.roi_points || []
  
  // Backward compatibility: If the database contains a single array of points (depth 2), wrap it in an array to make it depth 3 (list of polygons).
  if (initialPolygons.length > 0 && typeof initialPolygons[0][0] === 'number') {
    initialPolygons = [initialPolygons]
  }

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
              Tentukan batas wilayah utama <strong className="text-foreground font-semibold font-medium">Pos Kerja</strong> pegawai dapur. AI akan mendeteksi presensi pegawai secara mandiri di setiap pos yang Anda gambar. Alarm akan memicu jika ada <strong className="text-foreground font-semibold font-medium">salah satu pos yang kosong</strong> melebihi batas waktu yang ditentukan di konfigurasi sistem.
            </p>
          </div>
        </div>

        <RoiCanvas
          initialPolygons={initialPolygons}
          streamUrl={streamUrl}
        />
      </div>
    </DashboardLayout>
  )
}
