/**
 * Labour Entries API Route
 * GET: List all labour entries with filters
 * POST: Create new labour entry
 * 
 * GET /api/labour/entries
 * POST /api/labour/entries
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createLabourEntry, validateLabourEntry } from '@/lib/schemas/labour-entry-schema';
import {
  validatePhaseLabourBudget,
  updatePhaseLabourSpending,
  updateProjectLabourSpending,
  recalculatePhaseLabourSpending,
} from '@/lib/labour-financial-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { getProjectContext, createProjectFilter } from '@/lib/middleware/project-context';
import {
  updateWorkItemLabour,
  updateWorkItemStatusFromCompletion,
} from '@/lib/work-item-labour-helpers';
import {
  updateEquipmentOperatorHours,
} from '@/lib/equipment-operator-helpers';
import { updateLabourCostSummary } from '@/lib/labour-financial-helpers';

/**
 * GET /api/labour/entries
 * Returns labour entries with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: projectId, phaseId, floorId, workerId, status, dateFrom, dateTo, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const floorId = searchParams.get('floorId');
    const workerId = searchParams.get('workerId');
    const batchId = searchParams.get('batchId');
    const workItemId = searchParams.get('workItemId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'entryDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Get and validate project context
    const projectContext = await getProjectContext(request, user.id);

    // If projectId is provided, validate access
    if (projectContext.projectId && !projectContext.hasAccess) {
      return errorResponse(projectContext.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();

    // Build query with project filter
    const query = createProjectFilter(projectContext.projectId || projectId, {
      deletedAt: null, // Exclude soft-deleted entries
    });

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (floorId && ObjectId.isValid(floorId)) {
      query.floorId = new ObjectId(floorId);
    }

    if (workerId && ObjectId.isValid(workerId)) {
      query.workerId = new ObjectId(workerId);
    }

    if (batchId && ObjectId.isValid(batchId)) {
      query.batchId = new ObjectId(batchId);
    }

    if (workItemId && ObjectId.isValid(workItemId)) {
      query.workItemId = new ObjectId(workItemId);
    }

    if (status) {
      // Handle comma-separated status values (e.g., "approved,paid")
      if (status.includes(',')) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        query.status = { $in: statuses };
      } else {
        query.status = status;
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.entryDate = {};
      if (dateFrom) {
        query.entryDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.entryDate.$lte = new Date(dateTo);
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { workerName: { $regex: search, $options: 'i' } },
        { skillType: { $regex: search, $options: 'i' } },
        { taskDescription: { $regex: search, $options: 'i' } },
        { entryNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const entries = await db
      .collection('labour_entries')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate project, phase, and work item names for entries
    const projectIds = [...new Set(entries.map((e) => e.projectId?.toString()).filter(Boolean))];
    const phaseIds = [...new Set(entries.map((e) => e.phaseId?.toString()).filter(Boolean))];
    const workItemIds = [...new Set(entries.map((e) => e.workItemId?.toString()).filter(Boolean))];
    
    const projects = projectIds.length > 0 ? await db.collection('projects').find({
      _id: { $in: projectIds.map((id) => new ObjectId(id)) },
    }).toArray() : [];
    
    const phases = phaseIds.length > 0 ? await db.collection('phases').find({
      _id: { $in: phaseIds.map((id) => new ObjectId(id)) },
    }).toArray() : [];
    
    const workItems = workItemIds.length > 0 ? await db.collection('work_items').find({
      _id: { $in: workItemIds.map((id) => new ObjectId(id)) },
      deletedAt: null,
    }).toArray() : [];
    
    const projectMap = {};
    projects.forEach((project) => {
      projectMap[project._id.toString()] = {
        projectName: project.projectName,
        projectCode: project.projectCode,
      };
    });
    
    const phaseMap = {};
    phases.forEach((phase) => {
      phaseMap[phase._id.toString()] = {
        phaseName: phase.phaseName,
        phaseCode: phase.phaseCode,
      };
    });
    
    const workItemMap = {};
    workItems.forEach((workItem) => {
      workItemMap[workItem._id.toString()] = {
        workItemName: workItem.name,
        workItemCategory: workItem.category,
        workItemStatus: workItem.status,
      };
    });
    
    // Add project, phase, and work item names to entries
    const entriesWithNames = entries.map((entry) => ({
      ...entry,
      projectName: entry.projectId ? projectMap[entry.projectId.toString()]?.projectName : null,
      phaseName: entry.phaseId ? phaseMap[entry.phaseId.toString()]?.phaseName : null,
      workItemName: entry.workItemId ? workItemMap[entry.workItemId.toString()]?.workItemName : null,
      workItemCategory: entry.workItemId ? workItemMap[entry.workItemId.toString()]?.workItemCategory : null,
    }));

    // Get total count for pagination
    const total = await db.collection('labour_entries').countDocuments(query);

    // Calculate totals
    const totals = await db.collection('labour_entries').aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
        },
      },
    ]).toArray();

    const summary = totals[0] || { totalHours: 0, totalCost: 0, entryCount: 0 };

    return successResponse(
      {
        entries: entriesWithNames,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalHours: summary.totalHours,
          totalCost: summary.totalCost,
          entryCount: summary.entryCount,
        },
      },
      'Labour entries retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/entries error:', error);
    return errorResponse('Failed to retrieve labour entries', 500);
  }
}

/**
 * POST /api/labour/entries
 * Creates a new labour entry
 * Auth: OWNER only (in single-user mode)
 * 
 * CRITICAL: All budget updates are atomic and validated
 */
export async function POST(request) {
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

    const hasAccess = await hasPermission(user.id, 'create_labour_entry');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to create labour entries.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      phaseId,
      isIndirectLabour,
      floorId,
      categoryId,
      workItemId,
      workerId,
      workerName,
      workerType,
      workerRole,
      skillType,
      entryDate,
      clockInTime,
      clockOutTime,
      breakDuration,
      totalHours,
      overtimeHours,
      taskDescription,
      quantityCompleted,
      unitOfMeasure,
      unitRate,
      hourlyRate,
      dailyRate,
      serviceType,
      visitPurpose,
      deliverables,
      qualityRating,
      productivityRating,
      notes,
      equipmentId,
      subcontractorId,
    } = body;

    // Validation
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    // PhaseId is required only for direct labour
    // Indirect labour (site management, security, etc.) doesn't need a phase
    const indirectLabour = isIndirectLabour === true;
    if (!indirectLabour) {
      if (!phaseId || !ObjectId.isValid(phaseId)) {
        return errorResponse('Valid phaseId is required for direct labour', 400);
      }
    }

    if (!workerName || workerName.trim().length < 2) {
      return errorResponse('workerName is required and must be at least 2 characters', 400);
    }

    if (hourlyRate === undefined || hourlyRate === null || isNaN(hourlyRate) || hourlyRate < 0) {
      return errorResponse('hourlyRate is required and must be >= 0', 400);
    }

    // Normalize optional rating fields (handle empty strings, NaN, invalid values)
    const normalizeRating = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const num = typeof value === 'string' ? parseFloat(value.trim()) : Number(value);
      if (isNaN(num)) {
        return null;
      }
      // Only return if in valid range (1-5), otherwise null
      return (num >= 1 && num <= 5) ? num : null;
    };

    const normalizedQualityRating = normalizeRating(qualityRating);
    const normalizedProductivityRating = normalizeRating(productivityRating);

    // Create labour entry object
    const labourEntryData = {
      projectId,
      phaseId: indirectLabour ? null : phaseId, // PhaseId is null for indirect labour
      isIndirectLabour: indirectLabour,
      floorId,
      categoryId,
      workItemId,
      workerId,
      workerName,
      workerType: workerType || 'internal',
      workerRole: workerRole || 'skilled',
      skillType: skillType || 'general_worker',
      entryDate: entryDate || new Date(),
      clockInTime,
      clockOutTime,
      breakDuration,
      totalHours,
      overtimeHours,
      taskDescription,
      quantityCompleted,
      unitOfMeasure,
      unitRate,
      hourlyRate,
      dailyRate,
      serviceType,
      visitPurpose,
      deliverables,
      qualityRating: normalizedQualityRating,
      productivityRating: normalizedProductivityRating,
      notes,
      equipmentId,
      subcontractorId,
      createdBy: userProfile._id, // Add createdBy before validation
    };

    // Validate entry data (now includes createdBy)
    const validation = validateLabourEntry(labourEntryData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Create entry object
    const labourEntry = createLabourEntry(labourEntryData, userProfile._id);

    // CRITICAL: Validate budget BEFORE creating entry
    // For indirect labour, validate against indirect costs budget
    // For direct labour, validate against phase budget
    if (indirectLabour) {
      // Validate against indirect costs budget
      const { validateIndirectCostsBudget } = await import('@/lib/indirect-costs-helpers');
      // For indirect labour, we need to determine the category
      // Site management, security, etc. would be 'siteOverhead'
      const indirectCategory = 'siteOverhead'; // Default for indirect labour
      const budgetValidation = await validateIndirectCostsBudget(
        projectId,
        labourEntry.totalCost,
        indirectCategory
      );

      if (!budgetValidation.isValid) {
        return errorResponse(
          `Indirect costs budget validation failed: ${budgetValidation.message}`,
          400
        );
      }
    } else {
      // Validate against phase budget (direct labour)
      const budgetValidation = await validatePhaseLabourBudget(
        phaseId,
        labourEntry.totalCost
      );

      if (!budgetValidation.isValid) {
        return errorResponse(
          `Budget validation failed: ${budgetValidation.message}`,
          400
        );
      }
    }

    const db = await getDatabase();

    console.log('[POST /api/labour/entries] Starting transaction for atomic labour entry creation');

    // CRITICAL: Wrap all operations in transaction for atomicity
    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      // STEP 0: Create or get worker profile if needed (atomic)
      let workerProfileCreated = false;
      let createdWorkerProfile = null;
      
      // If workerId is not provided or empty, but workerName is provided, create/get worker profile
      if ((!workerId || workerId.trim() === '') && workerName && workerName.trim().length >= 2) {
        try {
          const { createOrGetWorkerProfileFromEntry } = await import('@/lib/helpers/worker-profile-helpers');
          const workerProfile = await createOrGetWorkerProfileFromEntry(
            labourEntryData,
            userProfile._id,
            { session, db: transactionDb }
          );
          
          // Update labour entry with worker profile ID
          labourEntry.workerId = workerProfile.userId || workerProfile._id;
          labourEntry.workerName = workerProfile.workerName;
          
          // Track if we created a new profile (vs found existing)
          if (workerProfile.createdAt && 
              new Date(workerProfile.createdAt).getTime() > Date.now() - 5000) {
            workerProfileCreated = true;
            createdWorkerProfile = workerProfile;
            console.log('[POST /api/labour/entries] Worker profile created:', workerProfile._id);
          } else {
            console.log('[POST /api/labour/entries] Existing worker profile found:', workerProfile._id);
          }
        } catch (error) {
          console.error('[POST /api/labour/entries] Error creating worker profile:', error);
          // Don't fail the entry creation if worker profile creation fails
          // Just log the error and continue
        }
      }

      // STEP 1: Insert labour entry (atomic)
      const entryResult = await transactionDb.collection('labour_entries').insertOne(
        labourEntry,
        { session }
      );

      const insertedEntry = { ...labourEntry, _id: entryResult.insertedId };
      console.log('[POST /api/labour/entries] Labour entry inserted:', entryResult.insertedId);

      // STEP 2: Update phase actual spending (atomic) - only for direct labour
      // Indirect labour doesn't have a phase, so skip phase spending update
      if (!indirectLabour && phaseId) {
        await updatePhaseLabourSpending(
          phaseId,
          labourEntry.totalCost,
          'add',
          session
        );
      }

      // STEP 3: Update project budget (atomic) - for both direct and indirect labour
      await updateProjectLabourSpending(
        projectId,
        labourEntry.totalCost,
        'add',
        session
      );

      // STEP 4: Update work item if linked (atomic)
      if (workItemId && ObjectId.isValid(workItemId)) {
        await updateWorkItemLabour(
          workItemId,
          labourEntry.totalHours || 0,
          labourEntry.totalCost,
          'add',
          session
        );

        // Update work item status based on completion (async, non-blocking)
        setImmediate(async () => {
          try {
            await updateWorkItemStatusFromCompletion(workItemId);
          } catch (error) {
            console.error('Error updating work item status:', error);
            // Don't throw - status update is non-critical
          }
        });
      }

      // STEP 4.5: Update equipment utilization if operator (atomic)
      if (labourEntry.equipmentId && ObjectId.isValid(labourEntry.equipmentId)) {
        await updateEquipmentOperatorHours(
          labourEntry.equipmentId.toString(),
          labourEntry.totalHours || 0,
          'add',
          session
        );
      }

      // STEP 5: Auto-approve for owner (atomic)
      await transactionDb.collection('labour_entries').updateOne(
        { _id: entryResult.insertedId },
        {
          $set: {
            status: 'approved',
            updatedAt: new Date(),
          },
        },
        { session }
      );

      // STEP 6: Create audit log (atomic)
      await createAuditLog(
        {
          userId: userProfile._id.toString(),
          action: 'CREATED',
          entityType: 'LABOUR_ENTRY',
          entityId: entryResult.insertedId.toString(),
          projectId: projectId,
          changes: {
            created: insertedEntry,
            labourCost: labourEntry.totalCost,
            phaseBudgetImpact: {
              before: budgetValidation.currentSpending,
              after: budgetValidation.currentSpending + labourEntry.totalCost,
              budget: budgetValidation.budget,
            },
          },
        },
        { session }
      );

      return {
        entryId: entryResult.insertedId,
        entry: insertedEntry,
        workerProfileCreated,
        createdWorkerProfile: createdWorkerProfile ? {
          _id: createdWorkerProfile._id,
          workerName: createdWorkerProfile.workerName,
          employeeId: createdWorkerProfile.employeeId,
        } : null,
      };
    });

    console.log('[POST /api/labour/entries] Transaction completed successfully');

    // After transaction: Recalculate phase spending (ensures accuracy)
    // Recalculate phase spending only for direct labour (phaseId is not null)
    // Indirect labour doesn't have a phase, so skip phase recalculation
    if (!indirectLabour && phaseId) {
      await recalculatePhaseSpending(phaseId);
    }

    // Update labour cost summaries (async, non-blocking)
    setImmediate(async () => {
      try {
        // Only update phase labour summary if this is direct labour
        if (!indirectLabour && phaseId) {
          await updateLabourCostSummary(projectId, phaseId, 'phase_total');
        }
        await updateLabourCostSummary(projectId, null, 'project_total');
      } catch (error) {
        console.error('Error updating labour cost summaries:', error);
        // Don't throw - summary update is non-critical
      }
    });

    // Get updated entry
    const createdEntry = await db.collection('labour_entries').findOne({
      _id: transactionResult.entryId,
    });

    const successMessage = transactionResult.workerProfileCreated
      ? `Labour entry created and approved successfully. Worker profile created for ${transactionResult.createdWorkerProfile.workerName}.`
      : 'Labour entry created and approved successfully';

    return successResponse(
      {
        entry: createdEntry,
        budgetValidation: {
          available: budgetValidation.available,
          used: budgetValidation.currentSpending + labourEntry.totalCost,
          budget: budgetValidation.budget,
        },
        workerProfileCreated: transactionResult.workerProfileCreated,
        createdWorkerProfile: transactionResult.createdWorkerProfile,
      },
      successMessage
    );
  } catch (error) {
    console.error('POST /api/labour/entries error:', error);
    return errorResponse(
      error.message || 'Failed to create labour entry',
      500
    );
  }
}

