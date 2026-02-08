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
import { recalculateProjectFinances, validateCapitalRemoval } from '@/lib/financial-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

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
      const allocationProjectId = normalizeId(allocation.projectId);
      if (allocationProjectId && ObjectId.isValid(allocationProjectId)) {
        const project = await db
          .collection('projects')
          .findOne({ _id: new ObjectId(allocationProjectId) });

        if (project) {
          allocationsWithProjects.push({
            ...allocation,
            projectId: allocationProjectId,
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
    const allocations = Array.isArray(body?.allocations)
      ? body.allocations.map((alloc) => ({
          ...alloc,
          projectId: normalizeId(alloc.projectId),
        }))
      : body?.allocations;

    if (!Array.isArray(allocations)) {
      return errorResponse('Allocations must be an array', 400);
    }

    // Get current allocations to compare
    const currentAllocations = investor.projectAllocations || [];
    
    // Validate allocations
    const validation = await validateAllocations(id, allocations);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Check for removed allocations and validate capital removal
    const currentAllocationsMap = new Map();
    currentAllocations.forEach(alloc => {
      if (alloc.projectId) {
        const projectIdStr = alloc.projectId.toString();
        currentAllocationsMap.set(projectIdStr, alloc.amount || 0);
      }
    });

    const newAllocationsMap = new Map();
    allocations.forEach(alloc => {
      if (alloc.projectId) {
        const projectIdStr = alloc.projectId.toString();
        newAllocationsMap.set(projectIdStr, parseFloat(alloc.amount) || 0);
      }
    });

    // Find removed or reduced allocations
    const capitalRemovalWarnings = [];
    for (const [projectIdStr, currentAmount] of currentAllocationsMap.entries()) {
      const newAmount = newAllocationsMap.get(projectIdStr) || 0;
      const amountRemoved = currentAmount - newAmount;
      
      if (amountRemoved > 0) {
        // Capital is being removed from this project
        const removalValidation = await validateCapitalRemoval(projectIdStr, amountRemoved);
        
        if (!removalValidation.canRemove) {
          // Get project name for better error message
          const project = await db.collection('projects').findOne({
            _id: new ObjectId(projectIdStr),
          });
          const projectName = project?.projectName || projectIdStr;
          
          return errorResponse(
            `Cannot remove ${amountRemoved.toLocaleString()} from project "${projectName}". ${removalValidation.message}`,
            400
          );
        }
        
        // Warn if removal reduces available capital significantly
        if (removalValidation.availableAfterRemoval < removalValidation.currentAvailable * 0.2) {
          capitalRemovalWarnings.push({
            projectId: projectIdStr,
            amountRemoved,
            availableAfterRemoval: removalValidation.availableAfterRemoval,
          });
        }
      }
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

    // Auto-recalculate project finances for affected projects (synchronous to ensure data consistency)
    const projectIds = processedAllocations.map((alloc) => alloc.projectId.toString());
    const uniqueProjectIds = [...new Set(projectIds)]; // Remove duplicates
    
    // Recalculate finances for each affected project (await to ensure completion before response)
    const recalculationResults = await Promise.allSettled(
      uniqueProjectIds.map((projectId) => 
        recalculateProjectFinances(projectId)
      )
    );

    // Log results and collect any errors
    const recalculationErrors = [];
    recalculationResults.forEach((result, index) => {
      const projectId = uniqueProjectIds[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ Project finances updated for project ${projectId} after allocation change`);
      } else {
        const error = result.reason;
        console.error(`❌ Error updating project finances for project ${projectId}:`, error);
        recalculationErrors.push({
          projectId,
          error: error.message || String(error),
        });
      }
    });

    // If recalculation failed for any project, include warning in response
    // But still return success since allocations were saved
    const responseData = {
      allocations: processedAllocations.map((alloc) => ({
        ...alloc,
        projectId: alloc.projectId.toString(),
      })),
      totalInvested: validation.totalInvested,
      totalAllocated: validation.totalAllocated,
      unallocated: validation.unallocated,
    };

    if (recalculationErrors.length > 0) {
      responseData.warnings = recalculationErrors.map(
        (err) => `Failed to update finances for project ${err.projectId}: ${err.error}`
      );
      console.warn('⚠️ Allocations saved but some finance recalculations failed:', recalculationErrors);
    }

    return successResponse(
      responseData,
      recalculationErrors.length > 0
        ? 'Allocations updated successfully, but some finance updates failed. Please refresh the project finances page.'
        : 'Allocations updated successfully'
    );
  } catch (error) {
    console.error('Update allocations error:', error);
    return errorResponse('Failed to update allocations', 500);
  }
}

