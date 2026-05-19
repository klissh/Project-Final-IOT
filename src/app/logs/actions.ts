'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteViolations(ids: string[]) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('violations')
    .delete()
    .in('id', ids)

  if (error) {
    console.error('Failed to delete violations:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/logs')
  return { success: true }
}
