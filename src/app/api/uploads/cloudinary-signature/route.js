/**
 * Cloudinary Signature API Route
 * POST: Generate signed upload signature for secure file uploads
 * 
 * POST /api/uploads/cloudinary-signature
 * Auth: Authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/uploads/cloudinary-signature
 * Generates a signed upload signature for Cloudinary
 * Security: Signs requests with Cloudinary API secret
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { folder, resourceType = 'image', publicId } = body;

    // Validate required environment variables
    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return errorResponse('Cloudinary configuration missing', 500);
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Build parameters for signature
    const params = {
      timestamp,
      ...(folder && { folder }),
      ...(publicId && { public_id: publicId }),
    };

    // Create signature
    const paramsString = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const signature = crypto
      .createHash('sha1')
      .update(paramsString + apiSecret)
      .digest('hex');

    return successResponse({
      signature,
      timestamp,
      cloudName,
      folder: folder || 'Kisheka_construction',
      resourceType,
      ...(publicId && { publicId }),
    });
  } catch (error) {
    console.error('Cloudinary signature error:', error);
    return errorResponse('Failed to generate upload signature', 500);
  }
}

