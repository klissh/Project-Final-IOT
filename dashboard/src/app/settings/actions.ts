'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching settings:', error)
    return null
  }

  // Jika tabel kosong, kembalikan default
  if (!data) {
    return {
      telegram_enabled: true,
      buzzer_enabled: true,
      ai_detection_active: true,
      log_enabled: true,
      confidence_threshold: 0.4,
      empty_post_timer: 5
    }
  }

  return data
}

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  
  const settings = {
    telegram_enabled: formData.get('telegram_bot_active') === 'on',
    buzzer_enabled: formData.get('esp32_buzzer_active') === 'on',
    ai_detection_active: formData.get('ai_detection_active') === 'on',
    log_enabled: formData.get('log_enabled') === 'on',
    confidence_threshold: parseFloat(formData.get('ai_confidence_threshold') as string) / 100,
    empty_post_timer: parseInt(formData.get('empty_post_timer') as string, 10) || 5,
    updated_at: new Date().toISOString()
  }

  const { data: existing } = await supabase.from('system_settings').select('id').limit(1).single()

  let error;
  if (existing) {
    const res = await supabase.from('system_settings').update(settings).eq('id', existing.id)
    error = res.error
  } else {
    const res = await supabase.from('system_settings').insert([settings])
    error = res.error
  }

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/settings')
  return { success: true }
}
