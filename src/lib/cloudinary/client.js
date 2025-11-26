/**
 * Cloudinary Client Configuration
 * Handles file uploads to Cloudinary for receipts, documents, and photos
 */

/**
 * Cloudinary configuration object
 * Uses "Kisheka_construction" as the base upload preset for all file types
 * Folder organization: Kisheka_construction/{type}/{projectId}/...
 * NOTE: The preset name must match what's configured in your Cloudinary dashboard
 */
export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  uploadPreset: {
    // All file types use the same base preset
    // Folder structure organizes files by type and project
    documents: 'Kisheka_construction', // For PDFs, contracts
    photos: 'Kisheka_construction', // For JPG/PNG/WebP
    receipts: 'Kisheka_construction', // For receipts and invoices
  },
};

/**
 * Uploads a file to Cloudinary
 * @param {File} file - The file to upload
 * @param {keyof typeof cloudinaryConfig.uploadPreset} uploadPreset - Type of upload preset to use
 * @param {string} folder - Folder path in Cloudinary (e.g., 'projects/projectId')
 * @returns {Promise<string>} The secure URL of the uploaded file
 * @throws {Error} If upload fails
 */
export async function uploadToCloudinary(file, uploadPreset, folder) {
  if (!cloudinaryConfig.cloudName) {
    throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not configured');
  }

  if (!cloudinaryConfig.uploadPreset[uploadPreset]) {
    throw new Error(`Invalid upload preset: ${uploadPreset}`);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset[uploadPreset]);
  formData.append('folder', folder);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Gets Cloudinary image URL with transformations
 * @param {string} publicId - Cloudinary public ID of the image
 * @param {object} transformations - Cloudinary transformation options
 * @returns {string} Transformed image URL
 */
export function getCloudinaryUrl(publicId, transformations = {}) {
  if (!cloudinaryConfig.cloudName) {
    throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not configured');
  }

  const baseUrl = `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload`;
  const transformString = Object.entries(transformations)
    .map(([key, value]) => `${key}_${value}`)
    .join(',');

  return transformString
    ? `${baseUrl}/${transformString}/${publicId}`
    : `${baseUrl}/${publicId}`;
}

