/**
 * Phase Documents API Route
 * GET: List all documents for a phase
 * POST: Add a new document to a phase
 * 
 * GET /api/phases/[id]/documents
 * POST /api/phases/[id]/documents
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/phases/[id]/documents
 * Returns all documents for a phase
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const documents = phase.documents || [];

    return successResponse(documents, 'Documents retrieved successfully');
  } catch (error) {
    console.error('Get phase documents error:', error);
    return errorResponse('Failed to retrieve documents', 500);
  }
}

/**
 * POST /api/phases/[id]/documents
 * Adds a new document to a phase
 * Auth: PM, OWNER only
 * 
 * Body: {
 *   documentId: string (auto-generated if not provided),
 *   name: string (required),
 *   description: string (optional),
 *   category: string (required),
 *   url: string (required, Cloudinary URL),
 *   publicId: string (optional, Cloudinary public ID),
 *   fileType: string (optional),
 *   fileSize: number (optional),
 *   uploadedBy: ObjectId (auto-set from user),
 *   uploadedAt: Date (auto-set)
 * }
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasEditPermission = await hasPermission(user.id, 'edit_phase');
    if (!hasEditPermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can add documents.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const {
      documentId,
      name,
      description = '',
      category,
      url,
      publicId = null,
      fileType = null,
      fileSize = null
    } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return errorResponse('Document name is required', 400);
    }

    if (!category) {
      return errorResponse('Document category is required', 400);
    }

    if (!url) {
      return errorResponse('Document URL is required', 400);
    }

    const validCategories = ['drawings', 'specifications', 'permits', 'inspections', 'photos', 'other'];
    if (!validCategories.includes(category)) {
      return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`, 400);
    }

    const db = await getDatabase();
    
    // Verify phase exists
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Create document object
    const document = {
      documentId: documentId || new ObjectId().toString(),
      name: name.trim(),
      description: description.trim(),
      category,
      url,
      publicId,
      fileType,
      fileSize,
      uploadedBy: new ObjectId(userProfile._id),
      uploadedByUser: {
        userId: userProfile._id.toString(),
        name: userProfile.name || userProfile.firstName + ' ' + (userProfile.lastName || ''),
        email: userProfile.email
      },
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add document to phase
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { documents: document },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to add document', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PHASE_DOCUMENT',
      entityId: document.documentId,
      projectId: phase.projectId.toString(),
      phaseId: id,
      changes: { created: document }
    });

    return successResponse(document, 'Document added successfully', 201);
  } catch (error) {
    console.error('Add phase document error:', error);
    return errorResponse('Failed to add document', 500);
  }
}


