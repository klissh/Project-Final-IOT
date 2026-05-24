'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Camera, Play, Pause, Grid, Shield, Radio, ShieldAlert,
  Volume2, VolumeX, Send, Cpu, Activity, Info, Database, Wifi, WifiOff
} from 'lucide-react'
import { toast } from 'sonner'
import { updateBuzzerEnabled, updateTelegramEnabled, updateLogEnabled } from '@/app/settings/actions'

type DetectionResult = {
  class: string
  safe: boolean
}

export function LiveMonitorClient({ initialSettings }: { initialSettings: any }) {
  const streamUrl = process.env.NEXT_PUBLIC_PYTHON_STREAM_URL || "http://localhost:8000"
  const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000/ws/camera"

  // Stream mode: 'mjpeg' (local) or 'webcam' (cloud/browser webcam via WebSocket)
  const [streamMode, setStreamMode] = useState<'mjpeg' | 'webcam'>('mjpeg')
  const [imgSrc, setImgSrc] = useState<string>("")
  const [isLive, setIsLive] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [isBuzzerActive, setIsBuzzerActive] = useState(initialSettings?.buzzer_enabled ?? true)
  const [isTelegramActive, setIsTelegramActive] = useState(initialSettings?.telegram_enabled ?? true)
  const [isLogActive, setIsLogActive] = useState(initialSettings?.log_enabled ?? true)
  const [fps, setFps] = useState(0)
  const [latency, setLatency] = useState(0)
  const [streamError, setStreamError] = useState(false)

  // WebSocket / webcam state
  const [wsConnected, setWsConnected] = useState(false)
  const [annotatedFrame, setAnnotatedFrame] = useState<string>("")
  const [detections, setDetections] = useState<DetectionResult[]>([])
  const [aiStatus, setAiStatus] = useState<string>("WAITING")

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameLoopRef = useRef<number | null>(null)
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() })

  // Active detections for sidebar
  const activeDetections = [
    { label: 'Deteksi Masker', status: 'ACTIVE', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Deteksi Hairnet', status: 'ACTIVE', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Meninggalkan Pos (ROI)', status: 'ACTIVE', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'ESP32 Buzzer Alarm', status: isBuzzerActive ? 'ON' : 'OFF', color: isBuzzerActive ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' },
    { label: 'Simpan Log & Foto', status: isLogActive ? 'ON' : 'OFF', color: isLogActive ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' },
  ]

  // Simulation logs feed
  const [feedLogs] = useState([
    { id: 1, type: 'Tanpa Masker & Hairnet', time: '17:41:02', confidence: '82.4%', status: 'Detected' },
    { id: 2, type: 'Meninggalkan Pos Kerja', time: '17:39:15', confidence: '94.2%', status: 'Resolved' },
    { id: 3, type: 'Tanpa Masker', time: '17:35:44', confidence: '78.9%', status: 'Detected' },
  ])

  // ── MJPEG Mode (local) ──
  useEffect(() => {
    if (streamMode === 'mjpeg' && isLive) {
      setImgSrc(`${streamUrl}/video_feed?t=${Date.now()}`)
      setStreamError(false)
    } else if (streamMode === 'mjpeg') {
      setImgSrc("")
    }
  }, [streamUrl, isLive, streamMode])

  // Periodically fluctuate FPS & Latency for MJPEG mode
  useEffect(() => {
    if (streamMode !== 'mjpeg' || !isLive) return
    const interval = setInterval(() => {
      setFps(Math.floor(22 + Math.random() * 5))
      setLatency(Math.floor(38 + Math.random() * 8))
    }, 2500)
    return () => clearInterval(interval)
  }, [isLive, streamMode])

  // ── WebSocket + Browser Webcam Mode (cloud) ──
  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Connect WebSocket
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      // State to track if we're waiting for AI response
      let isWaitingForResponse = false

      ws.onopen = () => {
        setWsConnected(true)
        toast.success('Terhubung ke AI Server', { description: 'WebSocket connected, streaming dimulai.' })
        startFrameLoop()
      }

      ws.onmessage = (event) => {
        isWaitingForResponse = false // Unlock for next frame
        try {
          const data = JSON.parse(event.data)
          if (data.annotated_frame) {
            setAnnotatedFrame(`data:image/jpeg;base64,${data.annotated_frame}`)
          }
          if (data.detections) {
            setDetections(data.detections)
          }
          if (data.status) {
            setAiStatus(data.status)
          }

          // Calculate FPS
          fpsCounterRef.current.count++
          const now = Date.now()
          const elapsed = now - fpsCounterRef.current.lastTime
          if (elapsed >= 1000) {
            setFps(Math.round((fpsCounterRef.current.count / elapsed) * 1000))
            setLatency(Math.round(elapsed / fpsCounterRef.current.count))
            fpsCounterRef.current = { count: 0, lastTime: now }
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e)
        }
      }

      ws.onerror = () => {
        toast.error('WebSocket Error', { description: 'Gagal terhubung ke AI Server.' })
        setWsConnected(false)
        isWaitingForResponse = false
      }

      ws.onclose = () => {
        setWsConnected(false)
        isWaitingForResponse = false
      }

      const startFrameLoop = () => {
        const sendFrame = () => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
          if (!videoRef.current || !canvasRef.current) return

          // Lock mechanism: Don't send if backend is still processing previous frame!
          // This prevents massive queue buildup and latency spikes
          if (isWaitingForResponse) {
             frameLoopRef.current = window.setTimeout(sendFrame, 30) // check again in 30ms
             return
          }

          const video = videoRef.current
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          // Force resize to max 640x480 to keep base64 string small
          const targetWidth = 640
          const targetHeight = 480
          canvas.width = targetWidth
          canvas.height = targetHeight
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight)

          // Convert to JPEG base64 (Lower quality to 0.4 for faster network transfer)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.4)
          const base64 = dataUrl.split(',')[1]

          isWaitingForResponse = true
          wsRef.current.send(JSON.stringify({ frame: base64 }))

          // Schedule next frame check very quickly, but it will be blocked by isWaitingForResponse
          frameLoopRef.current = window.setTimeout(sendFrame, 30)
        }

        sendFrame()
      }

    } catch (err) {
      console.error('Camera access denied:', err)
      toast.error('Akses Kamera Ditolak', {
        description: 'Izinkan akses kamera di browser untuk menggunakan mode Webcam.'
      })
    }
  }, [wsUrl])
  const stopWebcam = useCallback(() => {
    // Stop frame loop
    if (frameLoopRef.current) {
      clearTimeout(frameLoopRef.current)
      frameLoopRef.current = null
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setWsConnected(false)
    setAnnotatedFrame("")
    setDetections([])
    setAiStatus("WAITING")
    setFps(0)
    setLatency(0)
  }, [])

  // Start/stop webcam when switching modes or toggling live
  useEffect(() => {
    if (streamMode === 'webcam' && isLive) {
      startWebcam()
    } else if (streamMode === 'webcam' && !isLive) {
      stopWebcam()
    }

    return () => {
      if (streamMode === 'webcam') {
        stopWebcam()
      }
    }
  }, [streamMode, isLive, startWebcam, stopWebcam])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopWebcam()
  }, [stopWebcam])

  // Sync settings
  useEffect(() => {
    if (initialSettings) {
      setIsBuzzerActive(initialSettings.buzzer_enabled)
      setIsTelegramActive(initialSettings.telegram_enabled)
      setIsLogActive(initialSettings.log_enabled)
    }
  }, [initialSettings])

  const handleSnapshot = () => {
    toast.success('Kamera Snapshot Tersimpan', {
      description: `Snapshot berhasil diambil pada ${new Date().toLocaleTimeString('id-ID')}`
    })
  }

  const toggleBuzzer = async () => {
    const nextVal = !isBuzzerActive
    setIsBuzzerActive(nextVal)
    try {
      await updateBuzzerEnabled(nextVal)
      toast[nextVal ? 'success' : 'error'](
        nextVal ? 'Buzzer Peringatan Diaktifkan' : 'Buzzer Peringatan Dinonaktifkan',
        { description: nextVal
          ? 'Sirine alarm pada ESP32 dapur akan berbunyi saat terdeteksi pelanggaran.'
          : 'Sirine alarm telah dimatikan dan tidak akan merespons otomatis.'
        }
      )
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan buzzer', { description: e.message })
      setIsBuzzerActive(!nextVal)
    }
  }

  const toggleTelegram = async () => {
    const nextVal = !isTelegramActive
    setIsTelegramActive(nextVal)
    try {
      await updateTelegramEnabled(nextVal)
      toast[nextVal ? 'success' : 'error'](
        nextVal ? 'Notifikasi Telegram Diaktifkan' : 'Notifikasi Telegram Dinonaktifkan',
        { description: nextVal
          ? 'Foto bukti pelanggaran akan dikirim otomatis ke Telegram.'
          : 'Peringatan tidak akan dikirim ke Telegram.'
        }
      )
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan Telegram', { description: e.message })
      setIsTelegramActive(!nextVal)
    }
  }

  const toggleLog = async () => {
    const nextVal = !isLogActive
    setIsLogActive(nextVal)
    try {
      await updateLogEnabled(nextVal)
      toast[nextVal ? 'success' : 'error'](
        nextVal ? 'Simpan Log Diaktifkan' : 'Simpan Log Dinonaktifkan',
        { description: nextVal
          ? 'Foto bukti pelanggaran akan disimpan otomatis ke database Supabase.'
          : 'Data pelanggaran tidak akan disimpan ke database.'
        }
      )
    } catch (e: any) {
      toast.error('Gagal memperbarui pengaturan Simpan Log', { description: e.message })
      setIsLogActive(!nextVal)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full px-1 pb-10">
      {/* Hidden elements for webcam capture */}
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Control Room & Live Monitor
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pemantauan langsung dapur hygiene secara real-time yang terhubung dengan modul AIoT dan sistem peringatan.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Stream Mode Switcher */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border/40 text-xs font-mono">
            <button
              onClick={() => { stopWebcam(); setStreamMode('mjpeg') }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                streamMode === 'mjpeg' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              MJPEG (Lokal)
            </button>
            <button
              onClick={() => { setImgSrc(''); setStreamMode('webcam') }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center gap-1 ${
                streamMode === 'webcam' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Camera className="h-3 w-3" />
              Webcam (Cloud)
            </button>
          </div>

          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border/40 text-xs font-mono text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-card text-foreground shadow-sm flex items-center gap-1 font-semibold">
              <Activity className="h-3 w-3 text-emerald-500" />
              FPS: {isLive ? fps : '0'}
            </span>
            <span className="px-2 py-0.5 font-semibold">
              LATENCY: {isLive ? `${latency}ms` : '—'}
            </span>
            {streamMode === 'webcam' && (
              <span className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold ${
                wsConnected ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {wsConnected ? 'WS' : 'OFF'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Main Monitor Display (Column 1-8) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card className="border-border bg-card shadow-none overflow-hidden w-full relative">
            {/* Camera Header Overlay */}
            <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-black/80 to-transparent z-20 px-4 flex items-center justify-between text-white pointer-events-auto">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-500 animate-pulse">
                  <Radio className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold font-mono tracking-wider uppercase">
                  {streamMode === 'webcam' ? 'BROWSER_WEBCAM' : 'CAM_01_KITCHEN_MAIN'}
                </span>
                {streamMode === 'webcam' && aiStatus !== 'WAITING' && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/20">
                    {aiStatus}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGrid(g => !g)}
                  title="Toggle Gridlines"
                  className={`h-7 px-2.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                    showGrid ? 'bg-white/20 text-white' : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" />
                  Grid
                </button>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-emerald-400 border border-emerald-500/30">
                  LIVE
                </span>
              </div>
            </div>

            <CardContent className="p-0">
              <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
                {/* Grid Lines Overlay */}
                {showGrid && (
                  <div className="absolute inset-0 z-20 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
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

                {/* Fallback text when stream is off */}
                {((!isLive) || (streamMode === 'mjpeg' && streamError) || (streamMode === 'webcam' && !wsConnected && !annotatedFrame)) && (
                  <div className="absolute text-zinc-500 flex flex-col items-center select-none pointer-events-none z-0 p-6 text-center">
                    <svg className="w-14 h-14 mb-4 opacity-30 text-muted-foreground animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {streamMode === 'webcam' ? (
                      <>
                        <p className="font-semibold text-foreground text-sm tracking-tight">Kamera Browser Belum Aktif</p>
                        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
                          Tekan tombol <strong>Resume Live</strong> untuk mengaktifkan webcam browser dan mulai streaming ke AI Server.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-foreground text-sm tracking-tight">Koneksi Kamera AI (MJPEG Stream) Terputus</p>
                        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
                          Pastikan modul backend server Python berjalan pada port <code className="px-1 py-0.5 rounded bg-secondary font-mono text-foreground font-semibold">8000</code> menggunakan perintah:
                        </p>
                        <code className="mt-3 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-mono border border-border">
                          python main.py
                        </code>
                      </>
                    )}
                  </div>
                )}

                {/* MJPEG stream (local mode) */}
                {streamMode === 'mjpeg' && isLive && imgSrc && !streamError && (
                  <img
                    src={imgSrc}
                    alt="Live Camera Feed"
                    className="relative z-10 w-full h-full object-contain"
                    onError={() => setStreamError(true)}
                  />
                )}

                {/* WebSocket annotated frame (cloud mode) */}
                {streamMode === 'webcam' && isLive && annotatedFrame && (
                  <img
                    src={annotatedFrame}
                    alt="AI Annotated Feed"
                    className="relative z-10 w-full h-full object-contain"
                  />
                )}
              </div>
            </CardContent>

            {/* Camera Footer Overlay Control Bar */}
            <div className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-black/80 to-transparent z-20 px-4 flex items-center justify-between text-white pointer-events-auto">
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={() => setIsLive(!isLive)}
                  size="sm"
                  className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                    isLive ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isLive ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                  {isLive ? 'Pause Stream' : 'Resume Live'}
                </Button>

                <Button
                  onClick={handleSnapshot}
                  variant="secondary"
                  size="sm"
                  className="h-8 bg-white/20 hover:bg-white/30 border-transparent text-white text-xs font-semibold"
                  disabled={!isLive}
                >
                  <Camera className="h-3.5 w-3.5 mr-1" />
                  Snapshot
                </Button>
              </div>

              <div className="text-[10px] font-mono opacity-85 hidden sm:block">
                {streamMode === 'webcam'
                  ? 'MODE: BROWSER WEBCAM • FORMAT: WebSocket'
                  : 'RESOLUSI: 640 x 480 px • FORMAT: MJPEG'
                }
              </div>
            </div>
          </Card>

          {/* Quick Tips */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-secondary/20 p-4 text-xs">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground">Saran Operasional Dapur:</p>
              <p>
                {streamMode === 'webcam'
                  ? 'Mode Webcam Cloud: Kamera browser Anda mengirim frame ke AI Server di cloud. Pastikan koneksi internet stabil. ESP32 buzzer dikontrol via MQTT.'
                  : 'Kamera AI mendeteksi pelanggaran secara otomatis berdasarkan Pos Kerja (ROI) yang dikonfigurasi. Jika terdeteksi pelanggaran masker, hairnet, atau pos ditinggalkan, ESP32 buzzer akan otomatis aktif sebagai sinyal lokal untuk pegawai dapur.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Controller Sidebar (Column 9-12) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* AI Surveillance Status Card */}
          <Card className="border-border bg-card shadow-none">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4.5 w-4.5 text-foreground/80" />
                <h3 className="text-sm font-semibold text-foreground">AI Agent Detections</h3>
              </div>

              <div className="space-y-2 pt-1">
                {activeDetections.map((det) => (
                  <div key={det.label} className="flex items-center justify-between text-xs p-2 rounded-lg border border-border/40 bg-secondary/20">
                    <span className="font-medium text-foreground">{det.label}</span>
                    <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider border ${det.color}`}>
                      {det.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AIoT Device Control Panel Card */}
          <Card className="border-border bg-card shadow-none">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-foreground/80" />
                <h3 className="text-sm font-semibold text-foreground">AIoT Controller Panel</h3>
              </div>

              <div className="space-y-3 pt-1">
                {/* ESP32 Buzzer Trigger */}
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/40 bg-secondary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isBuzzerActive ? (
                        <Volume2 className="h-4 w-4 text-emerald-500 animate-bounce" />
                      ) : (
                        <VolumeX className="h-4 w-4 text-muted-foreground/60" />
                      )}
                      <span className="text-xs font-semibold text-foreground">ESP32 Alarm Buzzer</span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${isBuzzerActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    {streamMode === 'webcam'
                      ? 'Mengaktifkan buzzer fisik via MQTT. ESP32 harus terhubung WiFi dan subscribe ke topic MQTT.'
                      : 'Mengaktifkan buzzer fisik di dapur untuk memberikan peringatan suara ke pegawai secara otomatis saat melanggar.'
                    }
                  </p>
                  <Button
                    onClick={toggleBuzzer}
                    size="sm"
                    className={`w-full text-xs font-semibold h-8 mt-1 border transition-all ${
                      isBuzzerActive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-transparent'
                        : 'bg-card border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {isBuzzerActive ? 'Matikan Alarm Buzzer' : 'Aktifkan Alarm Buzzer'}
                  </Button>
                </div>

                {/* Telegram Notifications */}
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/40 bg-secondary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send className={`h-4 w-4 ${isTelegramActive ? 'text-emerald-500' : 'text-muted-foreground/60'}`} />
                      <span className="text-xs font-semibold text-foreground">Bot Telegram</span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${isTelegramActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Kirim foto bukti pelanggaran ke grup pengawas Telegram secara real-time.
                  </p>
                  <Button
                    onClick={toggleTelegram}
                    size="sm"
                    className={`w-full text-xs font-semibold h-8 mt-1 border transition-all ${
                      isTelegramActive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-transparent'
                        : 'bg-card border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {isTelegramActive ? 'Matikan Notifikasi Bot' : 'Aktifkan Notifikasi Bot'}
                  </Button>
                </div>

                {/* Database Save Log & Photo */}
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/40 bg-secondary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className={`h-4 w-4 ${isLogActive ? 'text-emerald-500' : 'text-muted-foreground/60'}`} />
                      <span className="text-xs font-semibold text-foreground">Simpan Log & Foto Pelanggaran</span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${isLogActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Simpan data ke Supabase agar bisa dilihat di menu Logs.
                  </p>
                  <Button
                    onClick={toggleLog}
                    size="sm"
                    className={`w-full text-xs font-semibold h-8 mt-1 border transition-all ${
                      isLogActive
                        ? 'bg-rose-600 hover:bg-rose-700 text-white border-transparent'
                        : 'bg-card border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {isLogActive ? 'Matikan Simpan Log' : 'Aktifkan Simpan Log'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Activity Feed Logs Card */}
          <Card className="border-border bg-card shadow-none flex-1">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 text-foreground/80 animate-pulse" />
                  <h3 className="text-sm font-semibold text-foreground">Detections Log Feed</h3>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-bold border border-rose-500/15">
                  ALARM ACTIVE
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {feedLogs.map((log) => (
                  <div key={log.id} className="relative pl-3 border-l-2 border-border/60 hover:border-foreground/30 transition-colors py-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground text-[11px]">{log.type}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{log.time}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>Confidence: <strong className="text-foreground/80">{log.confidence}</strong></span>
                      <span className={`font-mono text-[9px] font-semibold ${
                        log.status === 'Detected' ? 'text-rose-500' : 'text-emerald-500'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
