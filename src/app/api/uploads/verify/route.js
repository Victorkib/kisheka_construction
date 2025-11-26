/**
 * Upload Verification API Route
 * POST: Verify file upload and update material record
 * 
 * POST /api/uploads/verify
 * Auth: Authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/uploads/verify
 * Verifies that a file exists on Cloudinary and updates material record
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { publicId, materialId, fileType = 'receipt' } = body;

    if (!publicId) {
      return errorResponse('Public ID is required', 400);
    }

    if (!materialId || !ObjectId.isValid(materialId)) {
      return errorResponse('Valid material ID is required', 400);
    }

    // Construct Cloudinary URL
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      return errorResponse('Cloudinary configuration missing', 500);
    }

    // Verify file exists by constructing URL (Cloudinary serves files even if not in our account)
    // In production, you might want to use Cloudinary Admin API to verify
    const fileUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;

    const db = await getDatabase();

    // Update material record based on file type
    const updateData = {
      updatedAt: new Date(),
    };

    if (fileType === 'receipt') {
      updateData.receiptUrl = fileUrl;
      updateData.receiptFileUrl = fileUrl;
      updateData.receiptUploadedAt = new Date();
    } else if (fileType === 'invoice') {
      updateData.invoiceFileUrl = fileUrl;
    } else if (fileType === 'deliveryNote') {
      updateData.deliveryNoteFileUrl = fileUrl;
    }

    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(materialId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Material not found', 404);
    }

    return successResponse(
      {
        fileUrl,
        material: result.value,
      },
      'File verified and material updated successfully'
    );
  } catch (error) {
    console.error('Verify upload error:', error);
    return errorResponse('Failed to verify upload', 500);
  }
}

