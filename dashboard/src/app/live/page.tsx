'use client'

import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'

export default function LivePage() {
  // Dalam production, URL ini sebaiknya dinamis dari env variable.
  // Untuk saat ini kita menggunakan fallback localhost:8000
  const streamUrl = process.env.NEXT_PUBLIC_PYTHON_STREAM_URL || "http://localhost:8000"

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Live Monitor</h2>
          <p className="text-zinc-400 mt-1">Pemantauan langsung dari kamera AI Dapur (MJPEG Stream).</p>
        </div>
        
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
          <CardContent className="p-0">
            {/* Mengganti aspect-video menjadi tinggi relatif viewport agar fit di layar dan tidak perlu scroll */}
            <div className="relative w-full h-[calc(100vh-15rem)] min-h-[400px] bg-black flex items-center justify-center">
              {/* Fallback teks jika stream mati */}
              <div className="absolute text-zinc-600 flex flex-col items-center">
                <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>Menunggu Koneksi Kamera AI (Port 8000)...</p>
                <p className="text-xs mt-2">Pastikan Anda sudah menjalankan <code>python main.py</code></p>
              </div>
              
              {/* Image element untuk menangkap stream MJPEG */}
              {/* Parameter time ditambahkan untuk mencegah browser caching */}
              <img 
                src={`${streamUrl}/video_feed?t=${Date.now()}`} 
                alt="Live Camera Feed"
                className="relative z-10 w-full h-full object-contain"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
