'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { updateRoiConfig, deleteRoiConfig } from './actions'
import { toast } from 'sonner'
import { Save, Trash2, Undo2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// [x, y] in absolute canvas coordinates
type Point = [number, number]
// [x, y] in normalized coordinates (0.0 to 1.0)
type NormalizedPoint = [number, number]

export function RoiCanvas({ 
  initialPoints = [],
  streamUrl 
}: { 
  initialPoints: NormalizedPoint[],
  streamUrl: string 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [points, setPoints] = useState<NormalizedPoint[]>(initialPoints)
  const [isSaving, setIsSaving] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)

  // Fungsi untuk menggambar di canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Bersihkan canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (points.length === 0) return

    // Konversi koordinat relatif (0-1) ke absolut (pixel)
    const absPoints: Point[] = points.map(([nx, ny]) => [
      nx * canvas.width,
      ny * canvas.height
    ])

    // Gambar area polygon
    ctx.beginPath()
    ctx.moveTo(absPoints[0][0], absPoints[0][1])
    for (let i = 1; i < absPoints.length; i++) {
      ctx.lineTo(absPoints[i][0], absPoints[i][1])
    }
    
    // Tutup polygon agar terhubung dari titik akhir ke titik awal
    ctx.closePath()

    // Warna isi area (hijau transparan)
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'
    ctx.fill()

    // Warna garis tepi (hijau menyala)
    ctx.strokeStyle = 'rgba(34, 197, 94, 1)'
    ctx.lineWidth = 3
    ctx.stroke()

    // Gambar titik sudut
    absPoints.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = 'white'
      ctx.fill()
      ctx.strokeStyle = 'rgba(34, 197, 94, 1)'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }

  // Update canvas setiap kali points berubah atau window diresize
  useEffect(() => {
    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        // Sesuaikan ukuran internal canvas dengan ukuran tampilannya
        const { width, height } = containerRef.current.getBoundingClientRect()
        canvasRef.current.width = width
        canvasRef.current.height = height
        drawCanvas()
      }
    }

    // Panggil saat mount
    resizeCanvas()

    // Pantau resize
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [points])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    // Hitung koordinat klik relatif terhadap canvas
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Konversi ke koordinat dinormalisasi (0.0 - 1.0)
    const nx = Math.max(0, Math.min(1, x / rect.width))
    const ny = Math.max(0, Math.min(1, y / rect.height))

    setPoints([...points, [nx, ny]])
  }

  const handleUndo = () => {
    setPoints(points.slice(0, -1))
  }

  const handleClear = () => {
    if (points.length === 0) return
    setIsClearDialogOpen(true)
  }

  const handleClearConfirm = () => {
    setPoints([])
    setIsClearDialogOpen(false)
  }

  const handleSave = async () => {
    if (points.length > 0 && points.length < 3) {
      toast.error('Gagal Menyimpan', {
        description: 'Polygon membutuhkan minimal 3 titik sudut.'
      })
      return
    }

    setIsSaving(true)
    
    // Jika tidak ada point, berarti menghapus konfigurasi dari database
    if (points.length === 0) {
      const result = await deleteRoiConfig()
      if (result.success) {
        toast.success('Konfigurasi ROI berhasil dihapus', {
          description: 'Fitur pemantauan "Pos Kosong" dinonaktifkan.'
        })
      } else {
        toast.error('Gagal menghapus ROI', { description: result.error })
      }
    } else {
      // Simpan koordinat baru
      const result = await updateRoiConfig(points)
      if (result.success) {
        toast.success('Konfigurasi Pos Kerja berhasil disimpan', {
          description: 'AI akan menghitung mundur jika area ini kosong selama 5 detik.'
        })
      } else {
        toast.error('Gagal menyimpan ROI', { description: result.error })
      }
    }
    
    setIsSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
        <div className="text-sm text-zinc-400">
          Titik koordinat: <strong className="text-zinc-200">{points.length}</strong>
          {points.length === 0 && <span className="ml-2 text-yellow-500">(Seluruh area dipantau)</span>}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo} 
            disabled={points.length === 0 || isSaving}
            className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Undo
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClear} 
            disabled={points.length === 0 || isSaving}
            className="border-red-900/50 bg-red-900/10 text-red-400 hover:bg-red-900 hover:text-white"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Menyimpan...' : 'Simpan Area (ROI)'}
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <CardContent className="p-0">
          <div 
            ref={containerRef}
            className="relative w-full h-[calc(100vh-20rem)] min-h-[400px] bg-black flex items-center justify-center cursor-crosshair overflow-hidden"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            {/* Background Stream Video */}
            {/* object-fill diperlukan agar rasio stream sesuai persis dengan ukuran container dan canvas overlay */}
            <img 
              src={`${streamUrl}/video_feed?t=${Date.now()}`} 
              alt="Live Camera Feed"
              className="absolute inset-0 w-full h-full object-fill opacity-70 pointer-events-none"
            />
            
            {/* Hint Overlay (hanya muncul saat kosong) */}
            {points.length === 0 && !isHovering && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-black/60 px-6 py-3 rounded-full text-zinc-300 border border-zinc-700 backdrop-blur-sm animate-pulse">
                  Klik di area gambar untuk mulai membuat Polygon
                </div>
              </div>
            )}

            {/* Drawing Canvas Overlay */}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full z-20"
            />
          </div>
        </CardContent>
      </Card>
      
      <p className="text-xs text-zinc-500">
        * Tip: Area (ROI) akan otomatis menutupi dirinya sendiri (menyambungkan titik terakhir ke titik awal). Klik tombol "Simpan" jika bentuknya sudah sesuai yang Anda inginkan.
      </p>

      {/* Confirmation Dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Hapus Area Pos Kerja?</DialogTitle>
            <DialogDescription className="text-zinc-400 mt-2">
              Apakah Anda yakin ingin menghapus semua titik yang sudah digambar? Ini akan menonaktifkan fitur deteksi <strong>"Meninggalkan Pos"</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0 border-t border-zinc-800/50 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsClearDialogOpen(false)}
              className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              Batal
            </Button>
            <Button 
              onClick={handleClearConfirm}
              className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20"
            >
              Ya, Reset Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
