'use client'

import { useEffect, useRef } from 'react'
import { signOut } from '@/app/login/actions'
import { toast } from 'sonner'
import { usePathname } from 'next/navigation'

export function AutoLogout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pathname = usePathname()

  // 30 menit = 30 * 60 * 1000 = 1800000 ms
  const TIMEOUT_MS = 30 * 60 * 1000

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Hanya jalankan timer jika TIDAK berada di halaman login
    if (pathname === '/login') return

    timeoutRef.current = setTimeout(async () => {
      // Hapus event listener agar tidak trigger lagi
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
      events.forEach(event => {
        document.removeEventListener(event, resetTimer)
      })

      // Tampilkan notifikasi
      toast.info('Sesi Berakhir', {
        description: 'Anda telah otomatis di-logout karena tidak ada aktivitas selama 30 menit.',
        duration: 5000,
      })
      
      // Beri sedikit jeda agar toast terlihat, lalu panggil fungsi logout
      setTimeout(async () => {
        await signOut()
      }, 1500)
    }, TIMEOUT_MS)
  }

  useEffect(() => {
    if (pathname === '/login') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      return
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    // Inisialisasi awal
    resetTimer()

    // Pasang listener di dokumen
    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true })
    })

    // Bersihkan saat unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      events.forEach(event => {
        document.removeEventListener(event, resetTimer)
      })
    }
  }, [pathname])

  return null // Komponen ini hanya berjalan di background, tidak merender UI
}
