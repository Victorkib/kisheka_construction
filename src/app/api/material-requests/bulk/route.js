/**
 * Bulk Material Request API Route
 * POST: Create bulk material request batch
 * GET: List bulk material request batches
 * 
 * POST /api/material-requests/bulk
 * GET /api/material-requests/bulk
 * Auth: CLERK, PM, OWNER, SUPERVISOR
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { recalculateProjectFinances, validateCapitalAvailability } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateMaterialRequestBatch } from '@/lib/schemas/material-request-batch-schema';
import {
  createBatch,
  getBatches,
  updateBatchStatus,
} from '@/lib/helpers/batch-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

/**
 * POST /api/material-requests/bulk
 * Creates a new bulk material request batch
 * Auth: CLERK, PM, OWNER, SUPERVISOR
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_bulk_material_request');
    if (!canCreate) {
      return errorResponse(
        'Insufficient permissions. Only CLERK, PM, OWNER, and SUPERVISOR can create bulk material requests.',
        403
      );
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const {
      projectId,
      batchName,
      defaultFloorId,
      defaultCategoryId,
      defaultPhaseId,
      defaultUrgency = 'medium',
      defaultReason,
      materials,
      autoApprove = false,
    } = body;

    // Validate required fields
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return errorResponse('At least one material is required', 400);
    }

    // Validate batch data
    const validation = validateMaterialRequestBatch({
      projectId,
      createdBy: userProfile._id.toString(),
      materials,
      defaultUrgency,
    });

    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Verify floor exists if provided
    if (defaultFloorId && ObjectId.isValid(defaultFloorId)) {
      const floor = await db.collection('floors').findOne({
        _id: new ObjectId(defaultFloorId),
      });
      if (!floor) {
        return errorResponse('Floor not found', 404);
      }
    }

    // Verify category exists if provided
    if (defaultCategoryId && ObjectId.isValid(defaultCategoryId)) {
      const category = await db.collection('categories').findOne({
        _id: new ObjectId(defaultCategoryId),
      });
      if (!category) {
        return errorResponse('Category not found', 404);
      }
      // Set default category name
      body.defaultCategory = category.name;
    }

    // Phase Enforcement: Phase is now REQUIRED for bulk requests
    // Either defaultPhaseId OR each material must have phaseId
    const materialsWithPhase = materials.filter(m => m.phaseId && ObjectId.isValid(m.phaseId));
    const hasDefaultPhase = defaultPhaseId && ObjectId.isValid(defaultPhaseId);
    const allMaterialsHavePhase = materials.length === materialsWithPhase.length;

    if (!hasDefaultPhase && !allMaterialsHavePhase) {
      return errorResponse(
        'Phase selection is required. Either provide defaultPhaseId for all materials, or specify phaseId for each material. ' +
        `Currently: ${materialsWithPhase.length} of ${materials.length} materials have phaseId, and no defaultPhaseId provided.`,
        400
      );
    }

    // Validate defaultPhaseId if provided using centralized helper
    if (hasDefaultPhase) {
      const { validatePhaseForMaterialRequest } = await import('@/lib/phase-validation-helpers');
      const phaseValidation = await validatePhaseForMaterialRequest(defaultPhaseId, projectId);
      
      if (!phaseValidation.isValid) {
        return errorResponse(`Default phase validation failed: ${phaseValidation.error}`, phaseValidation.phase ? 400 : 404);
      }
    }

    // Validate all material phaseIds using centralized helper
    const { validatePhaseForMaterialRequest } = await import('@/lib/phase-validation-helpers');
    const uniquePhaseIds = new Set();
    
    // Collect all phaseIds (default + per-material)
    if (hasDefaultPhase) {
      uniquePhaseIds.add(defaultPhaseId);
    }
    materialsWithPhase.forEach(m => {
      if (m.phaseId && ObjectId.isValid(m.phaseId)) {
        uniquePhaseIds.add(m.phaseId);
      }
    });

    // Validate each unique phaseId
    for (const phaseId of uniquePhaseIds) {
      const phaseValidation = await validatePhaseForMaterialRequest(phaseId, projectId);
      
      if (!phaseValidation.isValid) {
        return errorResponse(
          `Phase validation failed for phase ${phaseId}: ${phaseValidation.error}`,
          phaseValidation.phase ? 400 : 404
        );
      }
    }

    // Budget Validation: Validate bulk request budget across all phases
    const materialsWithCosts = materials.filter(m => {
      const cost = m.estimatedCost || (m.estimatedUnitCost && m.quantityNeeded ? m.estimatedUnitCost * m.quantityNeeded : 0);
      return cost > 0;
    });

    if (materialsWithCosts.length > 0) {
      const { validateBulkMaterialRequestBudget } = await import('@/lib/phase-helpers');
      const budgetValidation = await validateBulkMaterialRequestBudget(materialsWithCosts, defaultPhaseId);
      
      // Only block if budget is set AND exceeded
      // If budget is not set, operation is allowed (isValid = true)
      if (!budgetValidation.isValid) {
        return errorResponse(
          `Phase material budget (not capital) validation failed: ${budgetValidation.errors.join('; ')}`,
          400
        );
      }
      // Note: If budget is not set, budgetValidation.isValid will be true
      // and spending will still be tracked regardless
    }

    // Check capital availability (warning only, don't block request creation)
    let capitalWarning = null;
    try {
      const totalEstimatedCost = materialsWithCosts.reduce((sum, m) => {
        const cost = m.estimatedCost || (m.estimatedUnitCost && m.quantityNeeded ? m.estimatedUnitCost * m.quantityNeeded : 0);
        return sum + cost;
      }, 0);
      
      if (totalEstimatedCost > 0) {
        const capitalCheck = await validateCapitalAvailability(projectId, totalEstimatedCost);
        
        if (!capitalCheck.isValid && !capitalCheck.capitalNotSet) {
          capitalWarning = {
            message: `Insufficient capital (not budget). Available capital: ${capitalCheck.available.toLocaleString()}, Required: ${totalEstimatedCost.toLocaleString()}, Shortfall: ${(totalEstimatedCost - capitalCheck.available).toLocaleString()}`,
            available: capitalCheck.available,
            required: totalEstimatedCost,
            shortfall: totalEstimatedCost - capitalCheck.available,
          };
        } else if (capitalCheck.capitalNotSet) {
          capitalWarning = {
            message: 'No capital invested. Capital validation will occur when converting to purchase order.',
            type: 'info',
          };
        }
      } else if (materialsWithCosts.length === 0) {
        // If no estimated costs provided, show info message
        capitalWarning = {
          message: 'No estimated costs provided. Capital validation will occur when converting to purchase order.',
          type: 'info',
        };
      }
    } catch (capitalError) {
      // Don't fail request creation if capital check fails
      console.error('Capital check error during bulk material request creation:', capitalError);
    }

    // Determine initial status
    const userRole = normalizeUserRole(userProfile.role);
    let initialStatus = 'draft';
    let requiresApproval = true;

    // If OWNER and autoApprove, set status to approved
    if (autoApprove && isRole(userRole, 'owner')) {
      initialStatus = 'approved';
      requiresApproval = false;
    } else if (body.status === 'submitted' || autoApprove === false) {
      initialStatus = 'pending_approval';
      requiresApproval = true;
    }

    // Create batch using helper - wrap in transaction for atomicity
    const batchSettings = {
      projectId,
      batchName,
      defaultFloorId,
      defaultCategoryId,
      defaultCategory: body.defaultCategory,
      defaultPhaseId,
      defaultUrgency,
      defaultReason,
    };

    console.log('[POST /api/material-requests/bulk] Starting transaction for atomic batch creation');

    // Wrap batch creation and auto-approval in transaction
    const createdBatch = await withTransaction(async ({ db: transactionDb, session }) => {
      // Create batch with transaction support
      const batch = await createBatch(materials, batchSettings, userProfile, initialStatus, {
        session,
        db: transactionDb,
      });

      // If auto-approve and OWNER, approve all requests within transaction
      if (autoApprove && isRole(userRole, 'owner')) {
        // Approve all material requests in the batch (atomic)
        await transactionDb.collection('material_requests').updateMany(
          { _id: { $in: batch.materialRequestIds } },
          {
            $set: {
              status: 'approved',
              approvedBy: new ObjectId(userProfile._id),
              approvedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
              approvalDate: new Date(),
              updatedAt: new Date(),
            },
          },
          { session }
        );

        // Update batch with approval info (atomic)
        await transactionDb.collection('material_request_batches').updateOne(
          { _id: batch._id },
          {
            $set: {
              status: 'approved',
              approvedBy: new ObjectId(userProfile._id),
              approvedAt: new Date(),
              approvalNotes: 'Auto-approved by OWNER',
              updatedAt: new Date(),
            },
          },
          { session }
        );
      }

      return batch;
    });

    console.log('[POST /api/material-requests/bulk] Transaction completed successfully');

    // Trigger financial recalculation (idempotent, can happen outside transaction)
    if (autoApprove && isRole(userRole, 'owner') && createdBatch.totalEstimatedCost > 0) {
      await recalculateProjectFinances(projectId.toString());
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'MATERIAL_REQUEST_BATCH',
      entityId: createdBatch._id.toString(),
      projectId: projectId,
      changes: { created: createdBatch },
    });

    // Create notifications
    if (requiresApproval) {
      // Notify approvers (PM/OWNER)
      const approvers = await db.collection('users').find({
        role: { $in: ['pm', 'project_manager', 'owner'] },
        status: 'active',
      }).toArray();

      if (approvers.length > 0) {
        const notifications = approvers.map((approver) => ({
          userId: approver._id.toString(),
          type: 'approval_needed',
          title: 'New Bulk Material Request',
          message: `${userProfile.firstName || userProfile.email} created a bulk request with ${materials.length} material(s) (${createdBatch.batchNumber})`,
          projectId: projectId,
          relatedModel: 'MATERIAL_REQUEST_BATCH',
          relatedId: createdBatch._id.toString(),
          createdBy: userProfile._id.toString(),
        }));

        await createNotifications(notifications);
      }
    } else {
      // Notify creator that batch was auto-approved
      await createNotifications([
        {
          userId: userProfile._id.toString(),
          type: 'approval_status',
          title: 'Bulk Request Auto-Approved',
          message: `Your bulk request ${createdBatch.batchNumber} with ${materials.length} material(s) has been auto-approved and is ready for supplier assignment`,
          projectId: projectId,
          relatedModel: 'MATERIAL_REQUEST_BATCH',
          relatedId: createdBatch._id.toString(),
          createdBy: userProfile._id.toString(),
        },
      ]);
    }

    return successResponse(
      {
        batchId: createdBatch._id,
        batchNumber: createdBatch.batchNumber,
        materialRequestIds: createdBatch.materialRequestIds,
        status: createdBatch.status,
        requiresApproval,
        totalMaterials: createdBatch.totalMaterials,
        totalEstimatedCost: createdBatch.totalEstimatedCost,
        ...(capitalWarning && { capitalWarning }),
      },
      'Bulk material request created successfully',
      201
    );
  } catch (error) {
    console.error('Create bulk material request error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      ...(error.cause && { cause: error.cause }),
    });
    return errorResponse(
      error.message || 'Failed to create bulk material request',
      500
    );
  }
}

/**
 * GET /api/material-requests/bulk
 * Lists bulk material request batches with filtering and pagination
 * Auth: CLERK, PM, OWNER, SUPERVISOR, ACCOUNTANT
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_bulk_material_requests');
    if (!canView) {
      return errorResponse(
        'Insufficient permissions to view bulk material requests',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const createdBy = searchParams.get('createdBy');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const filters = {};
    if (projectId) filters.projectId = projectId;
    if (status) filters.status = status;
    if (createdBy) filters.createdBy = createdBy;
    if (search) filters.search = search;

    const result = await getBatches(filters, { page, limit });

    return successResponse(result);
  } catch (error) {
    console.error('Get bulk material requests error:', error);
    return errorResponse('Failed to retrieve bulk material requests', 500);
  }
}
