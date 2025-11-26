/**
 * File Upload API Route
 * POST: Upload file to Cloudinary and return secure URL
 * 
 * POST /api/uploads/upload
 * Auth: Authenticated users
 * 
 * This route handles file uploads server-side for security.
 * Files are uploaded to Cloudinary and the secure URL is returned.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { v2 as cloudinary } from 'cloudinary';

/**
 * POST /api/uploads/upload
 * Uploads a file to Cloudinary
 * 
 * Body (FormData):
 * - file: File to upload
 * - uploadPreset: Type of preset ('receipts', 'photos', 'documents')
 * - folder: Cloudinary folder path (optional)
 * 
 * Returns: { success: true, data: { url: string, publicId: string } }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Validate Cloudinary configuration
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      return errorResponse('Cloudinary configuration missing', 500);
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file');
    const uploadPresetType = formData.get('uploadPreset') || 'receipts';
    const folder = formData.get('folder') || 'Kisheka_construction';

    if (!file || !(file instanceof File)) {
      return errorResponse('No file provided', 400);
    }

    // Validate file size (max 10MB for safety)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return errorResponse('File size exceeds 10MB limit', 400);
    }

    // All file types use the same base preset: Kisheka_construction
    // Folder structure organizes files by type and project
    const uploadPreset = 'Construction_Accountability_System';

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: cloudName,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Convert File to Buffer for server-side upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary using SDK
    try {
      // Convert buffer to data URI for Cloudinary upload
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.type};base64,${base64}`;

      // Upload with options
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
          dataUri,
          {
            folder: folder,
            upload_preset: uploadPreset,
            resource_type: 'auto', // Auto-detect image/video/raw
            public_id: `${folder}/${file.name.replace(/\.[^/.]+$/, '')}`, // Remove extension, Cloudinary adds it
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });

      const fileUrl = uploadResult.secure_url;
      const publicId = uploadResult.public_id;

      return successResponse(
        {
          url: fileUrl,
          publicId: publicId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
        'File uploaded successfully'
      );
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return errorResponse(uploadError.message || 'Upload failed', 500);
    }
  } catch (error) {
    console.error('Upload API error:', error);
    return errorResponse('Internal server error', 500);
  }
}

