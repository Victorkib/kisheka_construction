/**
 * Investor Allocations API Route
 * GET: Get investment allocations for an investor
 * POST: Set/update investment allocations for an investor
 * 
 * GET /api/investors/[id]/allocations
 * POST /api/investors/[id]/allocations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission, ROLES } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateAllocations } from '@/lib/investment-allocation';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

/**
 * GET /api/investors/[id]/allocations
 * Returns investment allocations for an investor
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
      const isOwnData =
        (investor.userId && investor.userId.toString() === userProfile._id.toString()) ||
        investor.email === userProfile.email ||
        investor.name?.toLowerCase().includes(userProfile.name?.toLowerCase() || '');
      if (!isOwnData) {
        return errorResponse('Access denied. You can only view your own allocations.', 403);
      }
    }

    // Get allocations with project details
    const allocations = investor.projectAllocations || [];
    const allocationsWithProjects = [];

    for (const allocation of allocations) {
      if (allocation.projectId && ObjectId.isValid(allocation.projectId)) {
        const project = await db
          .collection('projects')
          .findOne({ _id: new ObjectId(allocation.projectId) });

        if (project) {
          allocationsWithProjects.push({
            ...allocation,
            projectId: allocation.projectId,
            projectName: project.projectName,
            projectCode: project.projectCode,
          });
        }
      }
    }

    // Calculate totals
    const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
    const unallocated = Math.max(0, (investor.totalInvested || 0) - totalAllocated);

    return successResponse({
      allocations: allocationsWithProjects,
      totalInvested: investor.totalInvested || 0,
      totalAllocated,
      unallocated,
    });
  } catch (error) {
    console.error('Get allocations error:', error);
    return errorResponse('Failed to retrieve allocations', 500);
  }
}

/**
 * POST /api/investors/[id]/allocations
 * Sets/updates investment allocations for an investor
 * Auth: OWNER only (or INVESTOR for their own allocations if allowed)
 * Body: { allocations: [{ projectId, amount, percentage?, loanPercentage?, notes? }] }
 */
export async function POST(request, { params }) {
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

    // Check permission - OWNER can manage all, INVESTOR can manage their own
    const isOwnData =
      (investor.userId && investor.userId.toString() === userProfile._id.toString()) ||
      investor.email === userProfile.email;

    if (userProfile.role?.toLowerCase() !== ROLES.OWNER.toLowerCase() && !isOwnData) {
      return errorResponse('Permission denied. Only OWNER can manage allocations for other investors.', 403);
    }

    const body = await request.json();
    const { allocations } = body;

    if (!Array.isArray(allocations)) {
      return errorResponse('Allocations must be an array', 400);
    }

    // Validate allocations
    const validation = await validateAllocations(id, allocations);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Process allocations - convert projectId strings to ObjectIds and add metadata
    const processedAllocations = allocations.map((alloc) => ({
      projectId: new ObjectId(alloc.projectId),
      amount: parseFloat(alloc.amount) || 0,
      percentage: alloc.percentage || null,
      loanPercentage: alloc.loanPercentage || null, // For MIXED investments
      notes: alloc.notes || null,
      allocatedAt: new Date(),
      allocatedBy: userProfile._id,
    }));

    // Update investor document
    await db
      .collection('investors')
      .updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            projectAllocations: processedAllocations,
            updatedAt: new Date(),
          },
        }
      );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id,
      action: 'UPDATE_INVESTOR_ALLOCATIONS',
      resourceType: 'investor',
      resourceId: new ObjectId(id),
      details: {
        investorName: investor.name,
        allocationsCount: processedAllocations.length,
        totalAllocated: validation.totalAllocated,
        unallocated: validation.unallocated,
      },
    });

    // Auto-recalculate project finances for affected projects (async, non-blocking)
    const projectIds = processedAllocations.map((alloc) => alloc.projectId.toString());
    const uniqueProjectIds = [...new Set(projectIds)]; // Remove duplicates
    
    // Recalculate finances for each affected project
    uniqueProjectIds.forEach((projectId) => {
      recalculateProjectFinances(projectId)
        .then(() => {
          console.log(`✅ Project finances updated for project ${projectId} after allocation change`);
        })
        .catch((error) => {
          console.error(`❌ Error updating project finances for project ${projectId}:`, error);
          // Don't fail the allocation update if finances update fails
        });
    });

    return successResponse(
      {
        allocations: processedAllocations,
        totalInvested: validation.totalInvested,
        totalAllocated: validation.totalAllocated,
        unallocated: validation.unallocated,
      },
      'Allocations updated successfully'
    );
  } catch (error) {
    console.error('Update allocations error:', error);
    return errorResponse('Failed to update allocations', 500);
  }
}

