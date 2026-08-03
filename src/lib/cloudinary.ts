/**
 * Cloudinary Upload Service
 * Handles direct client-side unsigned uploads to Cloudinary for images, files, signatures, and documentation.
 */

interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME || '';
  const uploadPreset = (import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET || '';
  return { cloudName, uploadPreset };
}

export function isCloudinaryConfigured(): boolean {
  const { cloudName, uploadPreset } = getCloudinaryConfig();
  return !!cloudName && !!uploadPreset && cloudName !== 'your_cloud_name_here' && uploadPreset !== 'your_preset_here';
}

/**
 * Uploads a file or base64 data URI to Cloudinary using an unsigned upload preset.
 * 
 * @param fileOrBase64 File object or a base64 data URI string
 * @param resourceType Cloudinary resource type: 'image', 'raw' (for PDFs/documents), or 'auto'
 * @returns Promise<string> Secure URL of the uploaded asset
 */
export async function uploadToCloudinary(
  fileOrBase64: File | string,
  resourceType: 'image' | 'raw' | 'auto' = 'auto'
): Promise<string> {
  const { cloudName, uploadPreset } = getCloudinaryConfig();

  if (!isCloudinaryConfigured()) {
    console.warn(
      "Cloudinary is not fully configured. Define VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your environment variables. Falling back to mock URL or base64."
    );
    
    // Fallback: If it is a base64 signature, return it directly so the app still functions in local dev/demo
    if (typeof fileOrBase64 === 'string') {
      return fileOrBase64;
    }
    
    // If it's a file, we can convert it to base64 as fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(fileOrBase64 as File);
    });
  }

  const formData = new FormData();
  formData.append('file', fileOrBase64);
  formData.append('upload_preset', uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to upload to Cloudinary');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error: any) {
    console.error('Cloudinary Upload Error:', error);
    throw new Error(error.message || 'Error occurred during Cloudinary upload');
  }
}
