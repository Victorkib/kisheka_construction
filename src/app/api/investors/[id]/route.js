/**
 * Investor Detail API Route
 * GET: Get single investor
 * PATCH: Update investor (OWNER only)
 * DELETE: Soft delete investor (OWNER only)
 * 
 * GET /api/investors/[id]
 * PATCH /api/investors/[id]
 * DELETE /api/investors/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission, ROLES } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

/**
 * GET /api/investors/[id]
 * Returns a single investor
 * Auth: OWNER, ACCOUNTANT (all), INVESTOR (own data only)
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const db = await getDatabase();
    const investor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    if (!investor) {
      return errorResponse('Investor not found', 404);
    }

    // INVESTOR role can only see their own data
    if (userProfile.role?.toLowerCase() === ROLES.INVESTOR.toLowerCase()) {
      // Check by userId first (preferred), then fallback to email/name matching
      const isOwnData =
        (investor.userId && investor.userId.toString() === userProfile._id.toString()) ||
        investor.email === userProfile.email ||
        investor.name?.toLowerCase().includes(userProfile.name?.toLowerCase() || '');
      if (!isOwnData) {
        return errorResponse('Access denied. You can only view your own investor data.', 403);
      }
    }

    return successResponse(investor);
  } catch (error) {
    console.error('Get investor error:', error);
    return errorResponse('Failed to retrieve investor', 500);
  }
}

/**
 * PATCH /api/investors/[id]
 * Updates an investor
 * Auth: OWNER only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_investors');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can update investors.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      investmentType,
      loanTerms,
      documents,
      status,
      userId, // Optional: link to existing user account
    } = body;

    const db = await getDatabase();

    // Check if investor exists
    const existingInvestor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    if (!existingInvestor) {
      return errorResponse('Investor not found', 404);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (investmentType !== undefined) {
      if (!['EQUITY', 'LOAN', 'MIXED'].includes(investmentType)) {
        return errorResponse('Invalid investment type', 400);
      }
      updateData.investmentType = investmentType;
    }
    if (loanTerms !== undefined) updateData.loanTerms = loanTerms;
    if (documents !== undefined) updateData.documents = documents;
    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status)) {
        return errorResponse('Invalid status', 400);
      }
      updateData.status = status;
    }

    // Validate userId if provided
    if (userId !== undefined) {
      if (userId === null) {
        // Allow removing userId link
        updateData.userId = null;
      } else {
        if (!ObjectId.isValid(userId)) {
          return errorResponse('Invalid userId format', 400);
        }
        
        // Check if user exists
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
          return errorResponse('User not found', 404);
        }
        
        // Check if another investor already exists for this user
        const existingInvestorForUser = await db.collection('investors').findOne({ 
          userId: new ObjectId(userId),
          _id: { $ne: new ObjectId(id) } // Exclude current investor
        });
        if (existingInvestorForUser) {
          return errorResponse('Another investor record already exists for this user', 400);
        }
        
        // Verify email matches if provided
        const finalEmail = email !== undefined ? email : existingInvestor.email;
        if (finalEmail && user.email && finalEmail.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
          return errorResponse('Email does not match the linked user account', 400);
        }
        
        updateData.userId = new ObjectId(userId);
      }
    }
    
    // Check email uniqueness if email is being updated
    if (email && email !== existingInvestor.email) {
      const emailExists = await db.collection('investors').findOne({ email });
      if (emailExists) {
        return errorResponse('Investor with this email already exists', 400);
      }
    }

    const result = await db
      .collection('investors')
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    if (result.matchedCount === 0) {
      return errorResponse('Investor not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id,
      action: 'UPDATE_INVESTOR',
      resourceType: 'investor',
      resourceId: new ObjectId(id),
      details: {
        updatedFields: Object.keys(updateData),
      },
    });

    // Fetch updated investor
    const updatedInvestor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    return successResponse(updatedInvestor, 'Investor updated successfully');
  } catch (error) {
    console.error('Update investor error:', error);
    return errorResponse('Failed to update investor', 500);
  }
}

/**
 * DELETE /api/investors/[id]
 * Permanently deletes an investor with project finance recalculation
 * Auth: OWNER only
 * 
 * Query params:
 * - force: boolean - If true, bypasses allocation check (use with caution)
 * 
 * Handles:
 * - Removes all project allocations
 * - Recalculates project finances for all affected projects
 * - Hard deletes investor
 * 
 * Note: For archiving (soft delete), use POST /api/investors/[id]/archive
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_investors');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can delete investors.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const db = await getDatabase();

    // Check if investor exists
    const existingInvestor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    if (!existingInvestor) {
      return errorResponse('Investor not found', 404);
    }

    // Check if investor is already archived
    if (existingInvestor.status === 'ARCHIVED') {
      return errorResponse('Investor is already archived. Use restore endpoint to restore it first.', 400);
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Get allocations
    const allocations = existingInvestor.projectAllocations || [];
    const allocationsCount = allocations.length;
    const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);

    // If investor has allocations and force is not set, recommend archive instead
    if (allocationsCount > 0 && !force) {
      return errorResponse(
        {
          message: 'Investor has project allocations. Archive recommended instead of permanent delete.',
          recommendation: 'archive',
          allocationsCount,
          totalAllocated,
        },
        `This investor has ${allocationsCount} project allocation(s) totaling KES ${totalAllocated.toLocaleString()}. We strongly recommend archiving instead of permanently deleting to preserve financial records. Use POST /api/investors/${id}/archive to archive, or add ?force=true to proceed with permanent deletion.`,
        400
      );
    }

    // Step 1: Get all project IDs this investor has allocations to
    const projectIds = new Set();
    for (const allocation of allocations) {
      if (allocation.projectId) {
        const projectIdStr = allocation.projectId.toString ? allocation.projectId.toString() : String(allocation.projectId);
        if (projectIdStr && ObjectId.isValid(projectIdStr)) {
          projectIds.add(projectIdStr);
        }
      }
    }

    // Delete Cloudinary assets before deleting database record
    try {
      const { deleteInvestorCloudinaryAssets } = await import('@/lib/cloudinary-cleanup');
      const cleanupResult = await deleteInvestorCloudinaryAssets(existingInvestor);
      console.log(`🗑️ Cloudinary cleanup for investor ${id}: ${cleanupResult.success} deleted, ${cleanupResult.failed} failed`);
    } catch (cleanupError) {
      // Log error but don't fail the delete operation
      console.error(`⚠️ Error cleaning up Cloudinary assets for investor ${id}:`, cleanupError);
    }

    // Step 2: Hard delete investor
    const result = await db.collection('investors').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return errorResponse('Investor not found or delete failed', 404);
    }

    // Step 3: Recalculate project finances for all affected projects
    if (projectIds.size > 0) {
      projectIds.forEach((projectId) => {
        recalculateProjectFinances(projectId)
          .then(() => {
            console.log(`✅ Project finances updated for project ${projectId} after investor deletion`);
          })
          .catch((error) => {
            console.error(`❌ Error updating project finances for project ${projectId}:`, error);
          });
      });
    }

    // Step 4: Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED_PERMANENTLY',
      entityType: 'INVESTOR',
      entityId: id,
      changes: {
        status: {
          oldValue: existingInvestor.status,
          newValue: 'DELETED',
        },
      },
    });

    // Build response message
    let message = 'Investor permanently deleted successfully.';
    if (allocationsCount > 0) {
      message += ` Removed ${allocationsCount} project allocation(s). Project finances have been recalculated for ${projectIds.size} affected project(s).`;
    }

    return successResponse(
      {
        investorId: id,
        deleted: true,
        allocationsCount,
        affectedProjects: projectIds.size,
      },
      message
    );
  } catch (error) {
    console.error('Delete investor error:', error);
    return errorResponse('Failed to delete investor', 500);
  }
}

