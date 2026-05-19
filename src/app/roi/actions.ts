'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getRoiConfig() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('roi_config')
    .select('*')
    .eq('camera_index', 0)
    .single()
    
  return data
}

export async function updateRoiConfig(points: [number, number][]) {
  const supabase = await createClient()
  
  // Periksa apakah sudah ada konfigurasi untuk camera 0
  const { data: existing } = await supabase
    .from('roi_config')
    .select('id')
    .eq('camera_index', 0)
    .single()

  let error
  if (existing) {
    const { error: updateError } = await supabase
      .from('roi_config')
      .update({ 
        roi_points: points,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
    error = updateError
  } else {
    const { error: insertError } = await supabase
      .from('roi_config')
      .insert({ 
        camera_index: 0, 
        roi_points: points 
      })
    error = insertError
  }

  if (error) {
    console.error('Failed to update ROI config:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/roi')
  return { success: true }
}

export async function deleteRoiConfig() {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('roi_config')
    .delete()
    .eq('camera_index', 0)

  if (error) {
    console.error('Failed to delete ROI config:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/roi')
  return { success: true }
}
