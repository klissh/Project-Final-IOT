'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Bell, Cpu, Volume2, Video, RotateCcw, Save } from 'lucide-react'
import { updateSettings } from './actions'
import { toast } from 'sonner'

export default function SettingsForm({ initialSettings }: { initialSettings: any }) {
  const [loading, setLoading] = useState(false)
  const [aiActive, setAiActive] = useState(initialSettings?.ai_detection_active ?? true)
  const [buzzerActive, setBuzzerActive] = useState(initialSettings?.buzzer_enabled ?? true)
  const [telegramActive, setTelegramActive] = useState(initialSettings?.telegram_enabled ?? true)
  const [logEnabled, setLogEnabled] = useState(initialSettings?.log_enabled ?? true)
  const defaultThreshold = initialSettings ? Math.round(initialSettings.confidence_threshold * 100) : 40
  const [timerValue, setTimerValue] = useState(initialSettings?.empty_post_timer ?? 5)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.set('ai_detection_active', aiActive ? 'on' : 'off')
    formData.set('esp32_buzzer_active', buzzerActive ? 'on' : 'off')
    formData.set('telegram_bot_active', telegramActive ? 'on' : 'off')
    formData.set('log_enabled', logEnabled ? 'on' : 'off')
    try {
      await updateSettings(formData)
      toast.success('Pengaturan berhasil disimpan', {
        description: 'Perubahan sistem langsung diterapkan.',
      })
    } catch (error: any) {
      toast.error('Gagal menyimpan pengaturan', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* AI & Camera */}
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
              <Video className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Mode Kamera & AI</CardTitle>
              <CardDescription className="text-xs mt-0.5">Atur perilaku kamera dan mesin pendeteksi kebersihan.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* AI toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Aktifkan Deteksi AI</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Jika dimatikan, sistem berfungsi sebagai CCTV biasa.</p>
            </div>
            <Switch checked={aiActive} onCheckedChange={setAiActive} />
          </div>

          {/* Confidence slider */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Batas Kepekaan AI</Label>
              <span className="font-mono text-xs text-muted-foreground">confidence threshold</span>
            </div>
            <input
              type="range"
              name="ai_confidence_threshold"
              min="10"
              max="90"
              step="5"
              defaultValue={defaultThreshold}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted accent-foreground"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>10% — Sensitif</span>
              <span>90% — Ketat</span>
            </div>
          </div>

          {/* Empty post timer */}
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Toleransi Pos Kosong</Label>
              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-mono font-medium">
                {timerValue}s
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Waktu tunggu sebelum alarm dibunyikan saat area pos kerja kosong.
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                name="empty_post_timer"
                min="1"
                value={timerValue || ''}
                onChange={(e) => setTimerValue(parseInt(e.target.value) || 0)}
                className="w-24 font-mono text-sm"
              />
              <span className="text-sm text-muted-foreground">detik</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ESP32 */}
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
              <Volume2 className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Integrasi IoT (ESP32)</CardTitle>
              <CardDescription className="text-xs mt-0.5">Kontrol perangkat keras alarm buzzer.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Aktifkan Alarm Buzzer</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Menyalakan buzzer ESP32 saat pelanggaran terdeteksi.</p>
            </div>
            <Switch checked={buzzerActive} onCheckedChange={setBuzzerActive} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <Bell className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Pencatatan & Notifikasi</CardTitle>
              <CardDescription className="text-xs mt-0.5">Konfigurasi log database dan notifikasi Telegram.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Simpan Log & Foto Pelanggaran</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Simpan data ke Supabase agar bisa dilihat di menu Logs.</p>
            </div>
            <Switch checked={logEnabled} onCheckedChange={setLogEnabled} />
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
            <div>
              <Label className={`text-sm font-medium ${!logEnabled ? 'text-muted-foreground' : ''}`}>
                Aktifkan Bot Telegram
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {logEnabled ? 'Kirim peringatan ke HP Anda.' : 'Membutuhkan Log Pelanggaran aktif.'}
              </p>
            </div>
            <Switch
              checked={telegramActive}
              onCheckedChange={setTelegramActive}
              disabled={!logEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button type="submit" size="sm" disabled={loading} className="gap-2">
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </Button>
      </div>
    </form>
  )
}