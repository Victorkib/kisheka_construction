/**
 * Labour Batches API Route
 * GET: List all labour batches with filters
 * POST: Create new labour batch (bulk entry)
 *
 * GET /api/labour/batches
 * POST /api/labour/batches
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  createLabourBatch,
  validateLabourBatch,
  generateBatchNumber,
} from '@/lib/schemas/labour-batch-schema';
import {
  createLabourEntry,
  validateLabourEntry,
} from '@/lib/schemas/labour-entry-schema';
import {
  validatePhaseLabourBudget,
  updatePhaseLabourSpending,
  updateProjectLabourSpending,
} from '@/lib/labour-financial-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import {
  updateWorkItemLabour,
  updateWorkItemStatusFromCompletion,
} from '@/lib/work-item-labour-helpers';
import { updateEquipmentOperatorHours } from '@/lib/equipment-operator-helpers';
import {
  getProjectContext,
  createProjectFilter,
} from '@/lib/middleware/project-context';
import { updateLabourCostSummary } from '@/lib/labour-financial-helpers';

/**
 * GET /api/labour/batches
 * Returns labour batches with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: projectId, status, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Get and validate project context
    const projectContext = await getProjectContext(request, user.id);

    // If projectId is provided, validate access
    if (projectContext.projectId && !projectContext.hasAccess) {
      return errorResponse(
        projectContext.error || 'Access denied to this project',
        403
      );
    }

    const db = await getDatabase();

    // Build query with project filter
    const query = createProjectFilter(projectContext.projectId || projectId, {
      deletedAt: null, // Exclude soft-deleted batches
    });

    if (status) {
      query.status = status;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const batches = await db
      .collection('labour_batches')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const total = await db.collection('labour_batches').countDocuments(query);

    // Populate batch details (entries count, etc.)
    const batchesWithDetails = await Promise.all(
      batches.map(async (batch) => {
        // Get entries for this batch
        const entries = await db
          .collection('labour_entries')
          .find({
            batchId: batch._id,
            deletedAt: null,
          })
          .toArray();

        return {
          ...batch,
          actualEntryCount: entries.length,
          entries: entries.slice(0, 5), // Include first 5 entries for preview
        };
      })
    );

    return successResponse(
      {
        batches: batchesWithDetails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Labour batches retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/batches error:', error);
    return errorResponse('Failed to retrieve labour batches', 500);
  }
}

/**
 * POST /api/labour/batches
 * Creates a new labour batch (bulk entry)
 * Auth: OWNER only (in single-user mode)
 *
 * CRITICAL: All budget updates are atomic and validated
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasAccess = await hasPermission(user.id, 'create_labour_batch');
    if (!hasAccess) {
      return errorResponse(
        'Insufficient permissions. You do not have permission to create labour batches.',
        403
      );
    }

    const body = await request.json();
    const {
      projectId,
      batchName,
      defaultPhaseId,
      defaultFloorId,
      defaultCategoryId,
      defaultDate,
      entryType,
      defaultWorkerRole,
      labourEntries,
      workItemId, // Optional: work item ID to link all entries to
      isIndirectLabour = false, // NEW: Whether all entries in this batch are indirect
      indirectCostCategory = 'siteOverhead', // NEW: Category for indirect costs
      autoApprove = true, // Owner auto-approves by default
    } = body;

    // Validation
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    // PhaseId is required only for direct labour
    // Indirect labour is project-level, not phase-specific
    if (!isIndirectLabour) {
      if (!defaultPhaseId || !ObjectId.isValid(defaultPhaseId)) {
        return errorResponse(
          'Valid defaultPhaseId is required for direct labour entries',
          400
        );
      }
    }

    if (
      !labourEntries ||
      !Array.isArray(labourEntries) ||
      labourEntries.length === 0
    ) {
      return errorResponse('At least one labour entry is required', 400);
    }

    // Validate batch data
    const batchValidation = validateLabourBatch({
      projectId,
      createdBy: userProfile._id.toString(),
      entryType: entryType || 'time_based',
      labourEntries,
    });

    if (!batchValidation.isValid) {
      return errorResponse(
        `Validation failed: ${batchValidation.errors.join(', ')}`,
        400
      );
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Verify phase exists if provided
    let phase = null;
    if (defaultPhaseId && ObjectId.isValid(defaultPhaseId)) {
      phase = await db.collection('phases').findOne({
        _id: new ObjectId(defaultPhaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null,
      });

      if (!phase) {
        return errorResponse(
          'Phase not found or does not belong to this project',
          404
        );
      }
    }

    // Verify work item exists and belongs to phase if provided
    if (workItemId && ObjectId.isValid(workItemId)) {
      if (!defaultPhaseId || !ObjectId.isValid(defaultPhaseId)) {
        return errorResponse(
          'Phase is required when linking to a work item',
          400
        );
      }

      const workItem = await db.collection('work_items').findOne({
        _id: new ObjectId(workItemId),
        phaseId: new ObjectId(defaultPhaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null,
      });

      if (!workItem) {
        return errorResponse(
          'Work item not found or does not belong to the selected phase',
          404
        );
      }
    }

    // Validate all entries and calculate total cost
    // Also prepare worker profile creation data
    let totalBatchCost = 0;
    const validatedEntries = [];
    const workerProfileDataMap = new Map(); // Track unique workers to create profiles for

    // Normalize optional rating fields (handle empty strings, NaN, invalid values)
    const normalizeRating = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const num =
        typeof value === 'string' ? parseFloat(value.trim()) : Number(value);
      if (isNaN(num)) {
        return null;
      }
      // Only return if in valid range (1-5), otherwise null
      return num >= 1 && num <= 5 ? num : null;
    };

    for (const entryData of labourEntries) {
      const entryIsIndirect =
        entryData.isIndirectLabour !== undefined
          ? entryData.isIndirectLabour
          : isIndirectLabour;
      const entryPhaseId = entryIsIndirect
        ? null
        : entryData.phaseId || defaultPhaseId;
      const entryWorkItemId = entryIsIndirect
        ? null
        : entryData.workItemId || workItemId || null;
      const entryIndirectCategory = entryIsIndirect
        ? entryData.indirectCostCategory || indirectCostCategory || 'siteOverhead'
        : null;

      if (!entryIsIndirect && !entryWorkItemId) {
        return errorResponse('Work item is required for direct labour entries', 400);
      }

      // Use default values from batch if not provided in entry
      const entryWithDefaults = {
        ...entryData,
        projectId,
        phaseId: entryPhaseId, // No phase for indirect labour
        floorId: entryData.floorId || defaultFloorId,
        categoryId: entryData.categoryId || defaultCategoryId,
        entryDate: entryData.entryDate || defaultDate || new Date(),
        workerRole: entryData.workerRole || defaultWorkerRole || 'skilled',
        workItemId: entryWorkItemId, // Work items only for direct labour
        isIndirectLabour: entryIsIndirect, // Allow per-entry override
        indirectCostCategory: entryIndirectCategory, // Set category for indirect costs
        qualityRating: normalizeRating(entryData.qualityRating),
        productivityRating: normalizeRating(entryData.productivityRating),
        createdBy: userProfile._id, // Add createdBy before validation
      };

      // Track worker data for profile creation (if needed)
      const workerKey = entryData.workerName?.trim().toLowerCase();
      if (
        (!entryData.workerId || entryData.workerId.trim() === '') &&
        entryData.workerName &&
        entryData.workerName.trim().length >= 2 &&
        !workerProfileDataMap.has(workerKey)
      ) {
        workerProfileDataMap.set(workerKey, entryWithDefaults);
      }

      // Validate entry (now includes createdBy)
      const entryValidation = validateLabourEntry(entryWithDefaults);
      if (!entryValidation.isValid) {
        return errorResponse(
          `Entry validation failed: ${entryValidation.errors.join(', ')}`,
          400
        );
      }

      // Create entry object to calculate cost
      const entry = createLabourEntry(entryWithDefaults, userProfile._id);
      totalBatchCost += entry.totalCost;
      validatedEntries.push(entry);
    }

    // CRITICAL: Validate budget BEFORE creating batch
    // Separate entries by type (direct vs indirect) for different budget validations
    const directEntries = [];
    const indirectEntries = [];

    validatedEntries.forEach((entry) => {
      if (entry.isIndirectLabour) {
        indirectEntries.push(entry);
      } else {
        directEntries.push(entry);
      }
    });

    // Group direct entries by phase (used for validation, audit, and recalculation)
    const directEntriesByPhase = {};
    directEntries.forEach((entry) => {
      if (!entry.phaseId) {
        return;
      }
      const phaseId = entry.phaseId.toString();
      if (!directEntriesByPhase[phaseId]) {
        directEntriesByPhase[phaseId] = [];
      }
      directEntriesByPhase[phaseId].push(entry);
    });
    const entriesByPhase = directEntriesByPhase;

    // Validate direct labour budget by phase
    if (directEntries.length > 0) {
      for (const [phaseId, phaseEntries] of Object.entries(directEntriesByPhase)) {
        const phaseCost = phaseEntries.reduce(
          (sum, entry) => sum + entry.totalCost,
          0
        );
        const budgetValidation = await validatePhaseLabourBudget(
          phaseId,
          phaseCost
        );

        if (!budgetValidation.isValid) {
          return errorResponse(
            `Direct labour budget validation failed for phase: ${budgetValidation.message}`,
            400
          );
        }
      }
    }

    // Validate indirect labour budget (project-level) by category
    if (indirectEntries.length > 0) {
      const { validateIndirectCostsBudget } = await import(
        '@/lib/indirect-costs-helpers'
      );
      const indirectByCategory = {};
      indirectEntries.forEach((entry) => {
        const category = entry.indirectCostCategory || 'siteOverhead';
        if (!indirectByCategory[category]) {
          indirectByCategory[category] = 0;
        }
        indirectByCategory[category] += entry.totalCost;
      });

      for (const [category, cost] of Object.entries(indirectByCategory)) {
        const budgetValidation = await validateIndirectCostsBudget(
          projectId,
          cost,
          category
        );

        if (!budgetValidation.isValid) {
          return errorResponse(
            `Indirect labour budget validation failed (${category}): ${budgetValidation.message}`,
            400
          );
        }
      }
    }

    // Generate batch number
    const batchNumber = await generateBatchNumber(
      defaultDate ? new Date(defaultDate) : new Date()
    );

    // Create batch object
    const batchData = {
      batchName,
      projectId,
      defaultPhaseId: isIndirectLabour ? null : defaultPhaseId, // No phase for indirect batches
      defaultFloorId,
      defaultCategoryId,
      defaultDate: defaultDate ? new Date(defaultDate) : new Date(),
      entryType: entryType || 'time_based',
      defaultWorkerRole: defaultWorkerRole || null,
      workItemId: isIndirectLabour ? null : workItemId || null, // Work items only for direct labour
      isIndirectLabour, // NEW: Track if this batch is all indirect labour
      indirectCostCategory: isIndirectLabour ? indirectCostCategory : null, // NEW: Category for indirect costs
      labourEntries: validatedEntries,
      status: autoApprove ? 'approved' : 'draft',
    };

    const labourBatch = createLabourBatch(
      batchData,
      userProfile._id,
      `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
        userProfile.email
    );

    // Set batch number
    labourBatch.batchNumber = batchNumber;
    labourBatch.autoApproved = autoApprove;

    if (autoApprove) {
      labourBatch.approvedBy = userProfile._id;
      labourBatch.approvedAt = new Date();
      labourBatch.approvalNotes = 'Auto-approved by OWNER';
    }

    console.log(
      '[POST /api/labour/batches] Starting transaction for atomic batch creation'
    );

    // CRITICAL: Wrap all operations in transaction for atomicity
    const transactionResult = await withTransaction(
      async ({ db: transactionDb, session }) => {
        // STEP 0: Create worker profiles for new workers (atomic)
        const createdWorkerProfiles = [];
        const workerProfileMap = new Map(); // Map worker name to profile

        if (workerProfileDataMap.size > 0) {
          const { createOrGetWorkerProfileFromEntry } = await import(
            '@/lib/helpers/worker-profile-helpers'
          );

          for (const [workerKey, entryData] of workerProfileDataMap.entries()) {
            try {
              const workerProfile = await createOrGetWorkerProfileFromEntry(
                entryData,
                userProfile._id,
                { session, db: transactionDb }
              );

              workerProfileMap.set(workerKey, workerProfile);

              // Track if we created a new profile
              if (
                workerProfile.createdAt &&
                new Date(workerProfile.createdAt).getTime() > Date.now() - 5000
              ) {
                createdWorkerProfiles.push({
                  _id: workerProfile._id,
                  workerName: workerProfile.workerName,
                  employeeId: workerProfile.employeeId,
                });
                console.log(
                  '[POST /api/labour/batches] Worker profile created:',
                  workerProfile._id
                );
              }
            } catch (error) {
              console.error(
                '[POST /api/labour/batches] Error creating worker profile:',
                error
              );
              // Don't fail batch creation if worker profile creation fails
              // Just log the error and continue
            }
          }
        }

        // Update validated entries with worker profile IDs
        validatedEntries.forEach((entry) => {
          const workerKey = entry.workerName?.trim().toLowerCase();
          if (workerProfileMap.has(workerKey)) {
            const profile = workerProfileMap.get(workerKey);
            entry.workerId = profile.userId || profile._id;
            entry.workerName = profile.workerName;
          }
        });

        // STEP 1: Insert labour batch (atomic)
        const batchResult = await transactionDb
          .collection('labour_batches')
          .insertOne(labourBatch, { session });

        const insertedBatch = { ...labourBatch, _id: batchResult.insertedId };
        console.log(
          '[POST /api/labour/batches] Batch inserted:',
          batchResult.insertedId
        );

        // STEP 2: Create all labour entries (atomic)
        const entriesWithBatchId = validatedEntries.map((entry) => ({
          ...entry,
          batchId: batchResult.insertedId,
          batchNumber: batchNumber,
          status: autoApprove ? 'approved' : 'draft',
        }));

        const entryResults = await transactionDb
          .collection('labour_entries')
          .insertMany(entriesWithBatchId, { session });

        const entryIds = Object.values(entryResults.insertedIds);
        console.log(
          '[POST /api/labour/batches] Entries inserted:',
          entryIds.length
        );

        // STEP 3: Update batch with entry IDs (atomic)
        await transactionDb.collection('labour_batches').updateOne(
          { _id: batchResult.insertedId },
          {
            $set: {
              labourEntryIds: entryIds,
              totalEntries: entryIds.length,
              updatedAt: new Date(),
            },
          },
          { session }
        );

        // STEP 4: Update phase budgets (atomic) - only for direct labour
        if (directEntries.length > 0) {
          const directEntriesByPhase = {};
          directEntries.forEach((entry) => {
            const phaseId = entry.phaseId.toString();
            if (!directEntriesByPhase[phaseId]) {
              directEntriesByPhase[phaseId] = [];
            }
            directEntriesByPhase[phaseId].push(entry);
          });

          for (const [phaseId, phaseEntries] of Object.entries(
            directEntriesByPhase
          )) {
            const phaseCost = phaseEntries.reduce(
              (sum, entry) => sum + entry.totalCost,
              0
            );
            if (autoApprove) {
              await updatePhaseLabourSpending(
                phaseId,
                phaseCost,
                'add',
                session
              );
            }
          }
        }

        // STEP 4.5: Update indirect costs (atomic) - only for indirect labour
        if (indirectEntries.length > 0 && autoApprove) {
          const { updateIndirectCostsSpending } = await import(
            '@/lib/indirect-costs-helpers'
          );
          const indirectByCategory = {};
          indirectEntries.forEach((entry) => {
            const category = entry.indirectCostCategory || 'siteOverhead';
            if (!indirectByCategory[category]) {
              indirectByCategory[category] = 0;
            }
            indirectByCategory[category] += entry.totalCost;
          });

          // CRITICAL: Pass session for transaction atomicity
          for (const [category, amount] of Object.entries(indirectByCategory)) {
            await updateIndirectCostsSpending(
              projectId,
              category,
              amount,
              session
            );
          }
        }

        // STEP 5: Update project budget (atomic)
        if (autoApprove) {
          await updateProjectLabourSpending(
            projectId,
            totalBatchCost,
            'add',
            session
          );
        }

        // STEP 6: Update work items if linked (atomic) - only for direct labour
        const workItemUpdates = {};
        directEntries.forEach((entry) => {
          if (entry.workItemId && ObjectId.isValid(entry.workItemId)) {
            const workItemId = entry.workItemId.toString();
            if (!workItemUpdates[workItemId]) {
              workItemUpdates[workItemId] = { hours: 0, cost: 0 };
            }
            workItemUpdates[workItemId].hours += entry.totalHours || 0;
            workItemUpdates[workItemId].cost += entry.totalCost;
          }
        });

        for (const [workItemId, updates] of Object.entries(workItemUpdates)) {
          await updateWorkItemLabour(
            workItemId,
            updates.hours,
            updates.cost,
            'add',
            session
          );

          // Update work item status based on completion (async, non-blocking)
          setImmediate(async () => {
            try {
              await updateWorkItemStatusFromCompletion(workItemId);
            } catch (error) {
              console.error(
                `Error updating work item ${workItemId} status:`,
                error
              );
              // Don't throw - status update is non-critical
            }
          });
        }

        // STEP 6.5: Update equipment utilization if operators (atomic)
        const equipmentUpdates = {};
        validatedEntries.forEach((entry) => {
          if (entry.equipmentId && ObjectId.isValid(entry.equipmentId)) {
            const equipmentId = entry.equipmentId.toString();
            if (!equipmentUpdates[equipmentId]) {
              equipmentUpdates[equipmentId] = { hours: 0 };
            }
            equipmentUpdates[equipmentId].hours += entry.totalHours || 0;
          }
        });

        for (const [equipmentId, updates] of Object.entries(equipmentUpdates)) {
          await updateEquipmentOperatorHours(
            equipmentId,
            updates.hours,
            'add',
            session
          );
        }

        // STEP 7: Create audit log (atomic)
        await createAuditLog(
          {
            userId: userProfile._id.toString(),
            action: 'CREATED',
            entityType: 'LABOUR_BATCH',
            entityId: batchResult.insertedId.toString(),
            projectId: projectId,
            changes: {
              created: insertedBatch,
              totalCost: totalBatchCost,
              entryCount: entryIds.length,
              autoApproved: autoApprove,
              phaseBudgetImpacts: Object.entries(entriesByPhase).map(
                ([phaseId, entries]) => ({
                  phaseId,
                  cost: entries.reduce((sum, e) => sum + e.totalCost, 0),
                })
              ),
            },
          },
          { session }
        );

        return {
          batchId: batchResult.insertedId,
          batch: insertedBatch,
          entryIds,
          totalCost: totalBatchCost,
          createdWorkerProfiles: createdWorkerProfiles,
          workerProfilesCreated: createdWorkerProfiles.length,
        };
      }
    );

    console.log(
      '[POST /api/labour/batches] Transaction completed successfully'
    );

    // After transaction: Recalculate phase spending (ensures accuracy)
    if (autoApprove) {
      for (const phaseId of Object.keys(entriesByPhase)) {
        await recalculatePhaseSpending(phaseId);
      }

      // Update labour cost summaries (async, non-blocking)
      setImmediate(async () => {
        try {
          for (const phaseId of Object.keys(entriesByPhase)) {
            await updateLabourCostSummary(projectId, phaseId, 'phase_total');
          }
          await updateLabourCostSummary(projectId, null, 'project_total');
        } catch (error) {
          console.error('Error updating labour cost summaries:', error);
          // Don't throw - summary update is non-critical
        }
      });
    }

    // Get created batch with entries
    const createdBatch = await db.collection('labour_batches').findOne({
      _id: transactionResult.batchId,
    });

    const entries = await db
      .collection('labour_entries')
      .find({
        batchId: transactionResult.batchId,
      })
      .toArray();

    const successMessage =
      transactionResult.workerProfilesCreated > 0
        ? `Labour batch created and ${
            autoApprove ? 'approved' : 'saved as draft'
          } successfully. ${
            transactionResult.workerProfilesCreated
          } worker profile(s) created.`
        : `Labour batch created and ${
            autoApprove ? 'approved' : 'saved as draft'
          } successfully`;

    return successResponse(
      {
        batch: createdBatch,
        entries,
        totalCost: transactionResult.totalCost,
        entryCount: entries.length,
        budgetValidation: {
          totalCost: transactionResult.totalCost,
          phases: Object.entries(entriesByPhase).map(
            ([phaseId, phaseEntries]) => ({
              phaseId,
              cost: phaseEntries.reduce((sum, e) => sum + e.totalCost, 0),
              entryCount: phaseEntries.length,
            })
          ),
        },
        workerProfilesCreated: transactionResult.workerProfilesCreated || 0,
        createdWorkerProfiles: transactionResult.createdWorkerProfiles || [],
      },
      successMessage
    );
  } catch (error) {
    console.error('POST /api/labour/batches error:', error);
    return errorResponse(error.message || 'Failed to create labour batch', 500);
  }
}
