/**
 * Phase Document Detail API Route
 * PATCH: Update a document
 * DELETE: Remove a document from a phase
 * 
 * PATCH /api/phases/[id]/documents/[documentId]
 * DELETE /api/phases/[id]/documents/[documentId]
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
 * PATCH /api/phases/[id]/documents/[documentId]
 * Updates a document's metadata (name, description, category)
 * Auth: PM, OWNER only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
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
      return errorResponse('Insufficient permissions. Only PM and OWNER can edit documents.', 403);
    }

    const { id, documentId } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const { name, description, category } = body;

    const db = await getDatabase();
    
    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Find document
    const documents = phase.documents || [];
    const documentIndex = documents.findIndex(doc => doc.documentId === documentId);

    if (documentIndex === -1) {
      return errorResponse('Document not found', 404);
    }

    const oldDocument = documents[documentIndex];
    const updateData = {};

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return errorResponse('Document name cannot be empty', 400);
      }
      updateData['documents.$.name'] = name.trim();
    }

    if (description !== undefined) {
      updateData['documents.$.description'] = description.trim();
    }

    if (category !== undefined) {
      const validCategories = ['drawings', 'specifications', 'permits', 'inspections', 'photos', 'other'];
      if (!validCategories.includes(category)) {
        return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`, 400);
      }
      updateData['documents.$.category'] = category;
    }

    updateData['documents.$.updatedAt'] = new Date();
    updateData['updatedAt'] = new Date();

    // Update document
    const result = await db.collection('phases').findOneAndUpdate(
      { 
        _id: new ObjectId(id),
        'documents.documentId': documentId
      },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to update document', 500);
    }

    const updatedDocument = result.value.documents.find(doc => doc.documentId === documentId);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'PHASE_DOCUMENT',
      entityId: documentId,
      projectId: phase.projectId.toString(),
      phaseId: id,
      changes: { 
        before: oldDocument,
        after: updatedDocument
      }
    });

    return successResponse(updatedDocument, 'Document updated successfully');
  } catch (error) {
    console.error('Update phase document error:', error);
    return errorResponse('Failed to update document', 500);
  }
}

/**
 * DELETE /api/phases/[id]/documents/[documentId]
 * Removes a document from a phase
 * Auth: PM, OWNER only
 */
export async function DELETE(request, { params }) {
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
      return errorResponse('Insufficient permissions. Only PM and OWNER can delete documents.', 403);
    }

    const { id, documentId } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();
    
    // Get phase to find document
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Find document
    const documents = phase.documents || [];
    const document = documents.find(doc => doc.documentId === documentId);

    if (!document) {
      return errorResponse('Document not found', 404);
    }

    // Remove document from phase
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $pull: { documents: { documentId: documentId } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to delete document', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PHASE_DOCUMENT',
      entityId: documentId,
      projectId: phase.projectId.toString(),
      phaseId: id,
      changes: { deleted: document }
    });

    return successResponse(null, 'Document deleted successfully');
  } catch (error) {
    console.error('Delete phase document error:', error);
    return errorResponse('Failed to delete document', 500);
  }
}


