'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Bell, Cpu, Volume2, Video } from 'lucide-react'
import { updateSettings } from './actions'
import { toast } from 'sonner'

export default function SettingsForm({ initialSettings }: { initialSettings: any }) {
  const [loading, setLoading] = useState(false)

  // Gunakan state untuk melacak nilai switch agar mudah disubmit
  const [aiActive, setAiActive] = useState(initialSettings?.ai_detection_active ?? true)
  const [buzzerActive, setBuzzerActive] = useState(initialSettings?.buzzer_enabled ?? true)
  const [telegramActive, setTelegramActive] = useState(initialSettings?.telegram_enabled ?? true)
  const [logEnabled, setLogEnabled] = useState(initialSettings?.log_enabled ?? true)
  
  const defaultThreshold = initialSettings ? Math.round(initialSettings.confidence_threshold * 100) : 40
  const defaultTimer = initialSettings?.empty_post_timer ?? 5
  
  const [timerValue, setTimerValue] = useState(defaultTimer)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    // Timpa nilai checkbox dari state karena Switch base-ui terkadang tidak masuk ke FormData
    formData.set('ai_detection_active', aiActive ? 'on' : 'off')
    formData.set('esp32_buzzer_active', buzzerActive ? 'on' : 'off')
    formData.set('telegram_bot_active', telegramActive ? 'on' : 'off')
    formData.set('log_enabled', logEnabled ? 'on' : 'off')

    try {
      await updateSettings(formData)
      toast.success("Pengaturan berhasil disimpan!", {
        description: "Perubahan sistem langsung diterapkan."
      })
    } catch (error: any) {
      toast.error("Gagal menyimpan pengaturan", {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-500"/> Mode Kamera & AI
          </CardTitle>
          <CardDescription className="text-zinc-400">Atur perilaku kamera dan mesin pendeteksi kebersihan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-zinc-200">Aktifkan Deteksi AI</Label>
              <p className="text-sm text-zinc-500">
                Jika dimatikan, sistem berfungsi sebagai CCTV biasa.
              </p>
            </div>
            <Switch 
              checked={aiActive} 
              onCheckedChange={setAiActive} 
              className="data-[state=checked]:bg-blue-600"
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="flex justify-between">
              <Label className="text-base text-zinc-200">Batas Kepekaan AI (Confidence)</Label>
            </div>
            <div className="pt-4">
              <input 
                type="range" 
                name="ai_confidence_threshold"
                min="10" 
                max="90" 
                step="5"
                defaultValue={defaultThreshold}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-2 font-mono">
                <span>10% (Sensitif)</span>
                <span>90% (Ketat)</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <div className="flex justify-between items-center">
              <Label className="text-base text-zinc-200">Toleransi Waktu Pos Kosong</Label>
              <span className="text-sm font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                {timerValue} Detik
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              Waktu tunggu (hitung mundur) saat area Pos Kerja (ROI) kosong sebelum alarm dibunyikan. Admin bebas mengetik angka berapapun.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <Input 
                type="number" 
                name="empty_post_timer"
                min="1" 
                value={timerValue || ''}
                onChange={(e) => setTimerValue(parseInt(e.target.value) || 0)}
                className="w-24 bg-zinc-950 border-zinc-700 text-zinc-100 focus-visible:ring-blue-600"
              />
              <span className="text-sm text-zinc-400">Detik</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-orange-500"/> Integrasi IoT (ESP32)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-zinc-200">Aktifkan Alarm Buzzer</Label>
            </div>
            <Switch 
              checked={buzzerActive} 
              onCheckedChange={setBuzzerActive} 
              className="data-[state=checked]:bg-orange-600"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-green-500"/> Pencatatan & Notifikasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-zinc-200">Simpan Log & Foto Pelanggaran</Label>
              <p className="text-sm text-zinc-500">
                Simpan data pelanggaran ke Database Supabase agar bisa dilihat di menu Logs.
              </p>
            </div>
            <Switch 
              checked={logEnabled} 
              onCheckedChange={setLogEnabled} 
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <div className="space-y-0.5">
              <Label className="text-base text-zinc-200">Aktifkan Bot Telegram</Label>
              <p className="text-sm text-zinc-500">
                Kirim peringatan ke gawai Anda (membutuhkan Log Pelanggaran aktif).
              </p>
            </div>
            <Switch 
              checked={telegramActive} 
              onCheckedChange={setTelegramActive} 
              className="data-[state=checked]:bg-green-600"
              disabled={!logEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={() => window.location.reload()} className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white">
          Batal
        </Button>
        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20">
          {loading ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </form>
  )
}
