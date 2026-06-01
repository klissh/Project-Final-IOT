'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { updateRoiConfig, deleteRoiConfig } from './actions'
import { toast } from 'sonner'
import {
  Save, Trash2, Undo2, MousePointer2, Loader2, Info,
  Sliders, ShieldAlert, Sparkles, Crosshair, ListTodo, CircleCheck,
  LayoutGrid, Maximize, PanelLeft, PanelRight, MapPin, Plus
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type Point = [number, number]
type NormalizedPoint = [number, number]

export function RoiCanvas({
  initialPolygons = [],
  streamUrl,
}: {
  initialPolygons: NormalizedPoint[][]
  streamUrl: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [polygons, setPolygons] = useState<NormalizedPoint[][]>(initialPolygons.length > 0 ? initialPolygons : [[]])
  const [activeIndex, setActiveIndex] = useState<number>(0)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [imgSrc, setImgSrc] = useState<string>("")
  const [showGrid, setShowGrid] = useState(true)

  // Drag & drop state for active polygon
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null)
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null)

  const activePoints = polygons[activeIndex] || []

  useEffect(() => {
    setImgSrc(`${streamUrl}/video_feed?t=${Date.now()}`)
  }, [streamUrl])

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw all polygons
    polygons.forEach((pts, polyIndex) => {
      if (pts.length === 0) return
      
      const isActive = polyIndex === activeIndex
      const abs: Point[] = pts.map(([nx, ny]) => [nx * canvas.width, ny * canvas.height])

      // Draw polygon translucent overlay
      ctx.beginPath()
      ctx.moveTo(abs[0][0], abs[0][1])
      for (let i = 1; i < abs.length; i++) ctx.lineTo(abs[i][0], abs[i][1])
      ctx.closePath()
      
      // Gradient fill inside ROI zone
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      if (isActive) {
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.3)') // Blue for active
        grad.addColorStop(1, 'rgba(37, 99, 235, 0.15)')
      } else {
        grad.addColorStop(0, 'rgba(156, 163, 175, 0.2)') // Gray for inactive
        grad.addColorStop(1, 'rgba(107, 114, 128, 0.1)')
      }
      ctx.fillStyle = grad
      ctx.fill()
      
      ctx.strokeStyle = isActive ? 'rgba(59, 130, 246, 0.95)' : 'rgba(156, 163, 175, 0.6)'
      ctx.lineWidth = isActive ? 2.5 : 1.5
      ctx.setLineDash(isActive ? [4, 4] : []) // Cyber line dashes only for active
      ctx.stroke()
      ctx.setLineDash([]) // Reset
      
      // Draw Pos Label
      const cx = abs.reduce((sum, p) => sum + p[0], 0) / abs.length
      const cy = abs.reduce((sum, p) => sum + p[1], 0) / abs.length
      ctx.fillStyle = isActive ? 'rgba(59, 130, 246, 0.9)' : 'rgba(156, 163, 175, 0.8)'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`POS ${polyIndex + 1}`, cx - 20, cy)

      // Draw handles ONLY for active polygon
      if (isActive) {
        abs.forEach(([x, y], idx) => {
          const isHovered = hoveredNodeIndex === idx
          const isDragged = activeDragIndex === idx

          ctx.beginPath()
          ctx.arc(x, y, isHovered || isDragged ? 8 : 6, 0, Math.PI * 2)
          ctx.fillStyle = isHovered || isDragged ? '#2563eb' : '#ffffff'
          ctx.fill()
          ctx.strokeStyle = isHovered || isDragged ? '#ffffff' : '#2563eb'
          ctx.lineWidth = 2.5
          ctx.stroke()

          // Outer glow for active node
          if (isHovered || isDragged) {
            ctx.beginPath()
            ctx.arc(x, y, 12, 0, Math.PI * 2)
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.3)'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }

          // Point index tag
          ctx.fillStyle = isHovered || isDragged ? '#2563eb' : 'rgba(37, 99, 235, 0.8)'
          ctx.font = 'bold 10px monospace'
          ctx.fillText(`P${idx + 1}`, x + 10, y - 5)
        })
      }
    })
  }

  useEffect(() => {
    drawCanvas()
  }, [polygons, activeIndex, hoveredNodeIndex, activeDragIndex])

  // Drag & drop handlers (only affects activePoints)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height

    let closestIndex: number | null = null
    let minDistance = 16 // 16px radius for hit activation

    activePoints.forEach(([nx, ny], idx) => {
      const px = nx * canvasWidth
      const py = ny * canvasHeight
      const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2)
      if (dist < minDistance) {
        minDistance = dist
        closestIndex = idx
      }
    })

    if (closestIndex !== null) {
      setActiveDragIndex(closestIndex)
    } else {
      // Add point if we clicked on empty canvas area
      const nx = Math.max(0, Math.min(1, cx / canvasWidth))
      const ny = Math.max(0, Math.min(1, cy / canvasHeight))
      const newPolygons = [...polygons]
      newPolygons[activeIndex] = [...activePoints, [nx, ny]]
      setPolygons(newPolygons)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height

    if (activeDragIndex !== null) {
      // Update position of dragged node
      const nx = Math.max(0, Math.min(1, cx / canvasWidth))
      const ny = Math.max(0, Math.min(1, cy / canvasHeight))
      const newPolygons = [...polygons]
      const newPoints = [...activePoints]
      newPoints[activeDragIndex] = [nx, ny]
      newPolygons[activeIndex] = newPoints
      setPolygons(newPolygons)
    } else {
      // Check for hover near node
      let foundHoverIndex: number | null = null
      activePoints.forEach(([nx, ny], idx) => {
        const px = nx * canvasWidth
        const py = ny * canvasHeight
        const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2)
        if (dist < 14) {
          foundHoverIndex = idx
        }
      })
      setHoveredNodeIndex(foundHoverIndex)
    }
  }

  const handleMouseUp = () => {
    setActiveDragIndex(null)
  }

  const handleSave = async () => {
    const validPolygons = polygons.filter(p => p.length >= 3)
    
    if (validPolygons.length !== polygons.length) {
      toast.error('Ada Pos Tidak Valid', { description: 'Pastikan semua pos yang Anda buat memiliki minimal 3 titik.' })
      return
    }

    setIsSaving(true)
    if (validPolygons.length === 0) {
      const result = await deleteRoiConfig()
      if (result.success) toast.success('Konfigurasi ROI dihapus')
      else toast.error('Gagal menghapus ROI', { description: result.error })
    } else {
      const result = await updateRoiConfig(validPolygons)
      if (result.success) toast.success('Area pos kerja disimpan')
      else toast.error('Gagal menyimpan ROI', { description: result.error })
    }
    setIsSaving(false)
  }

  const handleImageLoad = () => {
    if (!containerRef.current || !canvasRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    canvasRef.current.width = width
    canvasRef.current.height = height
    drawCanvas()
  }

  // Predefined presets for active polygon
  const applyPreset = (type: 'full' | 'center' | 'left' | 'right') => {
    let presetPoints: NormalizedPoint[] = []
    switch (type) {
      case 'full':
        presetPoints = [
          [0.02, 0.02],
          [0.98, 0.02],
          [0.98, 0.98],
          [0.02, 0.98]
        ]
        break
      case 'center':
        presetPoints = [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.75, 0.75],
          [0.25, 0.75]
        ]
        break
      case 'left':
        presetPoints = [
          [0.02, 0.02],
          [0.5, 0.02],
          [0.5, 0.98],
          [0.02, 0.98]
        ]
        break
      case 'right':
        presetPoints = [
          [0.5, 0.02],
          [0.98, 0.02],
          [0.98, 0.98],
          [0.5, 0.98]
        ]
        break
    }
    const newPolygons = [...polygons]
    newPolygons[activeIndex] = presetPoints
    setPolygons(newPolygons)
    toast.success(`Preset '${type.toUpperCase()}' Diterapkan pada Pos ${activeIndex + 1}`, {
      description: 'Anda masih bisa menggeser/drag tiap node untuk menyesuaikannya.'
    })
  }

  const addNewPolygon = () => {
    setPolygons([...polygons, []])
    setActiveIndex(polygons.length)
  }

  const deleteActivePolygon = () => {
    if (polygons.length <= 1) {
      setPolygons([[]])
      setActiveIndex(0)
    } else {
      const newPolygons = polygons.filter((_, i) => i !== activeIndex)
      setPolygons(newPolygons)
      setActiveIndex(Math.max(0, activeIndex - 1))
    }
    setIsClearDialogOpen(false)
  }

  const undoActivePoint = () => {
    if (activePoints.length === 0) return
    const newPolygons = [...polygons]
    newPolygons[activeIndex] = activePoints.slice(0, -1)
    setPolygons(newPolygons)
  }

  const isValidPolygon = activePoints.length >= 3

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      {/* Left Column: Canvas Editor (8 Cols) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        {/* Polygon Tabs Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {polygons.map((pts, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`px-4 py-2 rounded-t-lg text-xs font-bold transition-colors ${
                idx === activeIndex
                  ? 'bg-card text-blue-500 border-t border-x border-blue-500/50'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary border-b border-border'
              }`}
            >
              POS {idx + 1}
            </button>
          ))}
          <button
            onClick={addNewPolygon}
            className="px-3 py-2 rounded-t-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors border-b border-border flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Pos
          </button>
        </div>

        {/* Editor Screen Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl rounded-tr-xl border border-border bg-card px-4 py-3 -mt-4">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
              <Sliders className="h-3.5 w-3.5" />
            </div>
            <span className="text-muted-foreground font-medium">Zone Mode:</span>
            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
              activePoints.length === 0 
                ? 'bg-zinc-500/15 text-zinc-400' 
                : isValidPolygon 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {activePoints.length === 0 ? 'MONITORING FULL-SCREEN' : isValidPolygon ? 'POLYGON AKTIF' : 'BUTUH 3 TITIK'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGrid(g => !g)}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                showGrid
                  ? 'bg-secondary border-border text-foreground'
                  : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Gridlines
            </button>
          </div>
        </div>

        {/* Dynamic Image & Drawing Canvas Card */}
        <Card className="border-border bg-card shadow-none overflow-hidden relative w-full mt-2">
          {/* Editor Mode Watermark */}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-blue-400 border border-blue-500/30 font-mono z-30 pointer-events-none select-none">
            ZONE_EDITOR_HUD // POS_{activeIndex + 1} // P_{activePoints.length}
          </div>

          <CardContent className="p-0">
            <div
              ref={containerRef}
              className="relative w-full max-w-5xl mx-auto bg-black flex items-center justify-center overflow-hidden rounded-lg"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              {/* Dynamic mouse cursor based on hover states */}
              <style jsx global>{`
                canvas {
                  cursor: ${activeDragIndex !== null ? 'grabbing' : hoveredNodeIndex !== null ? 'move' : 'crosshair'};
                }
              `}</style>

              {/* Rule of Thirds Guide lines */}
              {showGrid && (
                <div className="absolute inset-0 z-10 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-white" />
                  <div className="border-r border-white" />
                  <div className="border-transparent" />
                </div>
              )}

              {imgSrc && (
                <img
                  src={imgSrc}
                  alt="Live Camera Feed"
                  className="w-full h-auto block opacity-80 pointer-events-none"
                  onLoad={handleImageLoad}
                />
              )}

              {activePoints.length === 0 && !isHovering && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-35">
                  <div className="rounded-xl border border-blue-500/30 bg-background/85 px-6 py-4 text-center max-w-sm text-xs text-muted-foreground shadow-xl backdrop-blur-md animate-pulse">
                    <Sparkles className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                    <p className="font-semibold text-foreground text-xs">Gambar Area Pos Kerja Anda</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Klik langsung di atas gambar kamera untuk menaruh titik, lalu geser (drag) titik tersebut sesuka Anda!</p>
                  </div>
                </div>
              )}

              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="absolute inset-0 w-full h-full z-20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tip block */}
        <div className="flex items-start gap-2 rounded-xl border border-blue-500/10 bg-blue-500/5 p-3 text-xs">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-muted-foreground leading-normal">
            <p className="font-semibold text-foreground">Sistem Editor Vector Baru:</p>
            <p>1. <strong>Klik & Lepas</strong> di layar kosong untuk menambahkan titik baru pada Pos yang aktif.<br />
            2. <strong>Klik & Geser (Drag)</strong> pada bulatan node manapun untuk memindahkan posisinya secara presisi.</p>
          </div>
        </div>
      </div>

      {/* Right Column: Toolkit Deck & Coordinates List (4 Cols) */}
      <div className="lg:col-span-4 flex flex-col gap-5 mt-10 lg:mt-0">
        {/* Quick Preset Layouts */}
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4.5 w-4.5 text-foreground/80" />
              <h3 className="text-sm font-semibold text-foreground">Template Preset Instan</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-normal mt-1">
              Terapkan template ke <strong className="text-foreground">Pos {activeIndex + 1}</strong> dengan satu klik:
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('full')}
                className="gap-1.5 h-8.5 text-[11px] font-semibold border border-border/80 hover:bg-secondary"
              >
                <Maximize className="h-3 w-3 text-blue-500" />
                Full Screen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('center')}
                className="gap-1.5 h-8.5 text-[11px] font-semibold border border-border/80 hover:bg-secondary"
              >
                <MapPin className="h-3 w-3 text-emerald-500" />
                Center Zone
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('left')}
                className="gap-1.5 h-8.5 text-[11px] font-semibold border border-border/80 hover:bg-secondary"
              >
                <PanelLeft className="h-3 w-3 text-amber-500" />
                Left Half
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset('right')}
                className="gap-1.5 h-8.5 text-[11px] font-semibold border border-border/80 hover:bg-secondary"
              >
                <PanelRight className="h-3 w-3 text-rose-500" />
                Right Half
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Editor Controls Hub */}
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4.5 w-4.5 text-foreground/80" />
              <h3 className="text-sm font-semibold text-foreground">Editor Toolkit Deck</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={undoActivePoint}
                disabled={activePoints.length === 0 || isSaving}
                className="gap-1.5 h-9 font-semibold text-xs border border-border/80 hover:bg-secondary"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo Titik
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClearDialogOpen(true)}
                disabled={isSaving}
                className="gap-1.5 h-9 font-semibold text-xs text-rose-500 border border-border/80 hover:bg-rose-500/5 hover:border-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Pos {activeIndex + 1}
              </Button>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full text-xs font-semibold h-10 gap-1.5 bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Menyimpan Konfigurasi...' : 'Simpan Semua Pos Kerja'}
            </Button>
          </CardContent>
        </Card>

        {/* Placed Coordinates Node List */}
        <Card className="border-border bg-card shadow-none flex-1">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MousePointer2 className="h-4.5 w-4.5 text-foreground/80" />
                <h3 className="text-sm font-semibold text-foreground">Nodes (Pos {activeIndex + 1})</h3>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-foreground font-semibold">
                N_POINTS: {activePoints.length}
              </span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 pt-1">
              {activePoints.length === 0 ? (
                <div className="h-28 rounded-lg border border-dashed border-border/60 flex flex-col items-center justify-center text-center px-4">
                  <p className="text-xs text-muted-foreground/80 leading-normal">Belum ada titik di Pos {activeIndex + 1}.</p>
                </div>
              ) : (
                activePoints.map(([nx, ny], idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-secondary/15 text-[11px] font-mono">
                    <span className="font-semibold text-blue-500 dark:text-blue-400">Node P{idx + 1}</span>
                    <span className="text-muted-foreground">
                      X: <strong className="text-foreground">{nx.toFixed(3)}</strong> &bull; Y: <strong className="text-foreground">{ny.toFixed(3)}</strong>
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Rule Alert Controller Card */}
        <Card className="border-border bg-card shadow-none">
          <CardContent className="p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-foreground/80 animate-pulse" />
              <h3 className="text-sm font-semibold text-foreground">AI Vigilance Zone Rule</h3>
            </div>

            <div className="space-y-2.5 text-xs text-muted-foreground leading-normal pt-1">
              <div className="flex gap-2">
                <CircleCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground font-medium">Batas Waktu Kosong</strong>: Memanfaatkan pengaturan *empty_post_timer* di sistem.
                </p>
              </div>
              <div className="flex gap-2">
                <CircleCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground font-medium">Logika Alarm Multi-Pos</strong>: Jika ada <strong className="text-foreground">salah satu pos</strong> yang terdeteksi kosong, sirene dapur (ESP32) akan berdering.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Pos {activeIndex + 1}?</DialogTitle>
            <DialogDescription className="mt-1">
              Apakah Anda yakin ingin menghapus pos kerja ini? 
              Titik-titik pada pos ini akan hilang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              onClick={deleteActivePolygon}
              className="font-semibold text-xs h-9 px-4 bg-rose-600 hover:bg-rose-700"
            >
              Ya, Hapus Pos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}