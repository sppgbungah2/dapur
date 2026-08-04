import { supabase, isSupabaseConfigured } from './supabase';

export type StorageBucket = 'photos' | 'signatures' | 'documents';

/**
 * Utility: Converts a Base64 data URL string (e.g. data:image/png;base64,...) to a Blob object.
 */
export function base64ToBlob(base64DataUrl: string, defaultContentType = 'image/png'): Blob {
  try {
    if (base64DataUrl.startsWith('data:')) {
      const parts = base64DataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const contentType = mimeMatch ? mimeMatch[1] : defaultContentType;
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      return new Blob([uInt8Array], { type: contentType });
    }

    const raw = window.atob(base64DataUrl);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: defaultContentType });
  } catch (err) {
    console.warn('[SupabaseStorage] Error converting base64 to Blob:', err);
    throw new Error('Gagal mengonversi format gambar Base64 ke Blob.');
  }
}

/**
 * Uploads a file, Blob, or Base64 string to Supabase Storage Self-Hosted engine.
 * 
 * Target local server mounts:
 * - Bucket 'photos': /data/datadapur/photos/
 * - Bucket 'signatures': /data/datadapur/signatures/
 * - Bucket 'documents': /data/datadapur/uploads/
 */
export async function uploadToSupabaseStorage(
  fileOrBase64: File | Blob | string,
  bucket: StorageBucket = 'photos',
  filename?: string
): Promise<string> {
  if (!supabase || !isSupabaseConfigured) {
    console.warn(
      `[SupabaseStorage] Supabase client is not fully configured. Using fallback local representation.`
    );
    if (typeof fileOrBase64 === 'string') {
      return fileOrBase64;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(fileOrBase64 as File);
    });
  }

  let uploadBody: File | Blob;
  let contentType = 'image/png';
  let ext = 'png';

  if (typeof fileOrBase64 === 'string') {
    uploadBody = base64ToBlob(fileOrBase64, 'image/png');
    contentType = uploadBody.type || 'image/png';
    ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  } else if (fileOrBase64 instanceof File) {
    uploadBody = fileOrBase64;
    contentType = fileOrBase64.type || 'application/octet-stream';
    const nameParts = fileOrBase64.name.split('.');
    if (nameParts.length > 1) {
      ext = nameParts.pop() || 'bin';
    }
  } else {
    uploadBody = fileOrBase64;
    contentType = fileOrBase64.type || 'image/png';
    ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('jpeg') ? 'jpg' : 'png';
  }

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const filePath = filename || `${bucket}_${timestamp}_${randomStr}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, uploadBody, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(`[SupabaseStorage] Upload to bucket "${bucket}" failed:`, error);
      throw new Error(`Gagal mengunggah file ke bucket ${bucket}: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    if (publicUrlData && publicUrlData.publicUrl) {
      return publicUrlData.publicUrl;
    }

    return `storage/v1/object/public/${bucket}/${filePath}`;
  } catch (err: any) {
    console.error('[SupabaseStorage] Error uploading file:', err);
    if (typeof fileOrBase64 === 'string') {
      console.warn('[SupabaseStorage] Falling back to Base64 string for offline session');
      return fileOrBase64;
    }
    throw new Error(err.message || 'Gagal menyimpan file ke Supabase Storage HDD lokal.');
  }
}

/**
 * Convenience helper for Digital Signatures (Canvas Base64 / Blob -> Bucket 'signatures')
 */
export async function uploadSignature(base64OrBlob: string | Blob, customName?: string): Promise<string> {
  const fileName = customName || `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.png`;
  return uploadToSupabaseStorage(base64OrBlob, 'signatures', fileName);
}

/**
 * Convenience helper for QC Organoleptic & Cooking Photos (Bucket 'photos')
 */
export async function uploadQCPhoto(fileOrBase64: File | Blob | string, customName?: string): Promise<string> {
  return uploadToSupabaseStorage(fileOrBase64, 'photos', customName);
}

/**
 * Convenience helper for Documents / PDF Files (Bucket 'documents')
 */
export async function uploadDocument(fileOrBlob: File | Blob | string, customName?: string): Promise<string> {
  return uploadToSupabaseStorage(fileOrBlob, 'documents', customName);
}
