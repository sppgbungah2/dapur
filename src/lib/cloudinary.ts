/**
 * Deprecated / Migrated Cloudinary Compatibility Layer
 * All upload calls are now routed to Supabase Storage Self-Hosted Engine (HDD /data/datadapur/).
 */

import { uploadToSupabaseStorage, uploadSignature } from './supabaseStorage';
import { isSupabaseConfigured as isSupabaseReady } from './supabase';

export function getCloudinaryConfig() {
  return { cloudName: 'supabase_storage_migrated', uploadPreset: 'supabase_storage_migrated' };
}

export function isCloudinaryConfigured(): boolean {
  return isSupabaseReady;
}

/**
 * Migrated upload function - routes directly to Supabase Storage Self-Hosted HDD.
 */
export async function uploadToCloudinary(
  fileOrBase64: File | Blob | string,
  resourceType: 'image' | 'raw' | 'auto' = 'auto'
): Promise<string> {
  if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:image')) {
    // Canvas Digital Signature
    return uploadSignature(fileOrBase64);
  }

  if (resourceType === 'raw') {
    return uploadToSupabaseStorage(fileOrBase64, 'documents');
  }

  return uploadToSupabaseStorage(fileOrBase64, 'photos');
}
