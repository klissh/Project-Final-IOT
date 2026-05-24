'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function deleteViolations(ids: string[]) {
  const supabase = await createClient()

  // 1. Get screenshot_url values from the database first
  const { data: violations, error: fetchError } = await supabase
    .from('violations')
    .select('screenshot_url')
    .in('id', ids)

  if (fetchError) {
    console.error('Failed to fetch violations for deletion:', fetchError)
    return { success: false, error: fetchError.message }
  }

  // 2. If screenshots exist, delete them from Supabase Storage
  //    Using service_role key to bypass RLS/storage policies
  if (violations && violations.length > 0) {
    const bucketName = 'violation-screenshots'
    const filesToDelete: string[] = []

    for (const v of violations) {
      if (v.screenshot_url) {
        // Supabase public URL format:
        // https://<ref>.supabase.co/storage/v1/object/public/violation-screenshots/2026/05/19/<uuid>.jpg
        const searchStr = `/object/public/${bucketName}/`
        const index = v.screenshot_url.indexOf(searchStr)
        if (index !== -1) {
          const filePath = v.screenshot_url.substring(index + searchStr.length)
          filesToDelete.push(filePath)
        }
      }
    }

    if (filesToDelete.length > 0) {
      console.log('[deleteViolations] Deleting storage files:', filesToDelete)

      // Create an admin client with service_role key for storage operations
      const supabaseAdmin = createSupabaseClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )

      const { data: storageData, error: storageError } = await supabaseAdmin.storage
        .from(bucketName)
        .remove(filesToDelete)

      if (storageError) {
        console.error('Failed to delete screenshots from storage:', storageError)
      } else {
        console.log('[deleteViolations] Storage delete success:', storageData)
      }
    }
  }
  
  // 3. Delete database rows
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

