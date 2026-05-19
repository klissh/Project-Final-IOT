import { DashboardLayout } from '@/components/dashboard-layout'
import { RoiCanvas } from './roi-canvas'
import { getRoiConfig } from './actions'

export default async function RoiPage() {
  // Dalam production, URL ini sebaiknya dinamis dari env variable.
  // Untuk saat ini kita menggunakan fallback localhost:8000
  const streamUrl = process.env.NEXT_PUBLIC_PYTHON_STREAM_URL || "http://localhost:8000"

  // Ambil titik koordinat (jika ada) dari database
  const roiConfig = await getRoiConfig()
  const initialPoints = roiConfig?.roi_points || []

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Dynamic ROI (Pos Kerja)</h2>
          <p className="text-zinc-400 mt-1">
            Klik pada layar untuk menggambar area polygon yang merepresentasikan <strong>Pos Kerja</strong> utama. 
            AI akan memastikan ada pegawai yang berjaga di dalam kotak ini. Jika area ini kosong selama 5 detik berturut-turut, alarm peringatan "Meninggalkan Pos" akan dipicu.
          </p>
        </div>
        
        <RoiCanvas 
          initialPoints={initialPoints} 
          streamUrl={streamUrl} 
        />
      </div>
    </DashboardLayout>
  )
}
