/**
 * Professional Fees API Route
 * GET: List all professional fees with filtering and pagination
 * POST: Create new professional fee
 * 
 * GET /api/professional-fees
 * POST /api/professional-fees
 * Auth: All authenticated users (GET), OWNER/PM/ACCOUNTANT (POST)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  validateProfessionalFee,
  generateFeeCode,
} from '@/lib/schemas/professional-fees-schema';
import { FEE_STATUSES } from '@/lib/constants/professional-fees-constants';

/**
 * GET /api/professional-fees
 * Returns professional fees with filtering, sorting, and pagination
 * Query params: professionalServiceId, projectId, phaseId, feeType, status, search, page, limit, sortBy, sortOrder
 * Auth: All authenticated users
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const professionalServiceId = searchParams.get('professionalServiceId');
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const feeType = searchParams.get('feeType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };

    if (professionalServiceId && ObjectId.isValid(professionalServiceId)) {
      query.professionalServiceId = new ObjectId(professionalServiceId);
    }

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (feeType) {
      query.feeType = feeType;
    }

    if (status && FEE_STATUSES.includes(status)) {
      query.status = status;
    }

    // Text search
    if (search && search.trim()) {
      query.$or = [
        { feeCode: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { invoiceNumber: { $regex: search.trim(), $options: 'i' } },
        { referenceNumber: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const fees = await db.collection('professional_fees')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate related data
    const feesWithDetails = await Promise.all(
      fees.map(async (fee) => {
        const professionalService = await db.collection('professional_services').findOne({
          _id: fee.professionalServiceId,
        });

        const library = professionalService?.libraryId
          ? await db.collection('professional_services_library').findOne({
              _id: professionalService.libraryId,
            })
          : null;

        const project = await db.collection('projects').findOne({
          _id: fee.projectId,
        });

        const phase = fee.phaseId
          ? await db.collection('phases').findOne({
              _id: fee.phaseId,
            })
          : null;

        const activity = fee.activityId
          ? await db.collection('professional_activities').findOne({
              _id: fee.activityId,
            })
          : null;

        const expense = fee.expenseId
          ? await db.collection('expenses').findOne({
              _id: fee.expenseId,
            })
          : null;

        return {
          ...fee,
          professionalService: professionalService
            ? {
                _id: professionalService._id.toString(),
                professionalCode: professionalService.professionalCode,
                type: professionalService.type,
              }
            : null,
          library: library
            ? {
                _id: library._id.toString(),
                name: library.name,
                type: library.type,
              }
            : null,
          project: project
            ? {
                _id: project._id.toString(),
                projectCode: project.projectCode,
                projectName: project.projectName,
              }
            : null,
          phase: phase
            ? {
                _id: phase._id.toString(),
                phaseName: phase.phaseName,
                phaseCode: phase.phaseCode,
              }
            : null,
          activity: activity
            ? {
                _id: activity._id.toString(),
                activityCode: activity.activityCode,
                activityType: activity.activityType,
              }
            : null,
          expense: expense
            ? {
                _id: expense._id.toString(),
                expenseCode: expense.expenseCode,
                amount: expense.amount,
                status: expense.status,
              }
            : null,
        };
      })
    );

    const total = await db.collection('professional_fees').countDocuments(query);

    return successResponse({
      fees: feesWithDetails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get professional fees error:', error);
    return errorResponse('Failed to retrieve professional fees', 500);
  }
}

/**
 * POST /api/professional-fees
 * Creates a new professional fee
 * Auth: OWNER/PM/ACCOUNTANT
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - OWNER, PM, ACCOUNTANT can create fees
    const canCreate = await hasPermission(user.id, 'create_professional_fee');
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can create professional fees.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.professionalServiceId || !ObjectId.isValid(body.professionalServiceId)) {
      return errorResponse('Valid professionalServiceId is required', 400);
    }

    if (!body.projectId || !ObjectId.isValid(body.projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!body.feeType) {
      return errorResponse('Fee type is required', 400);
    }

    if (!body.amount || body.amount <= 0) {
      return errorResponse('Amount is required and must be greater than 0', 400);
    }

    const db = await getDatabase();

    // Verify professional service assignment exists
    const professionalService = await db.collection('professional_services').findOne({
      _id: new ObjectId(body.professionalServiceId),
      projectId: new ObjectId(body.projectId),
      deletedAt: null,
    });

    if (!professionalService) {
      return errorResponse('Professional service assignment not found or does not belong to this project', 404);
    }

    // Validate contract value - check if fee amount would exceed contract value
    const contractValue = professionalService.contractValue || 0;
    const currentTotalFees = professionalService.totalFees || 0;
    const newFeeAmount = parseFloat(body.amount);
    const newTotalFees = currentTotalFees + newFeeAmount;

    if (contractValue > 0 && newTotalFees > contractValue) {
      return errorResponse(
        `Fee amount would exceed contract value. Contract: ${contractValue.toLocaleString()} ${body.currency || 'KES'}, Current fees: ${currentTotalFees.toLocaleString()} ${body.currency || 'KES'}, New fee: ${newFeeAmount.toLocaleString()} ${body.currency || 'KES'}, Total would be: ${newTotalFees.toLocaleString()} ${body.currency || 'KES'}`,
        400
      );
    }

    // Warn if approaching contract limit (90% utilization)
    if (contractValue > 0) {
      const contractUtilization = (newTotalFees / contractValue) * 100;
      if (contractUtilization > 90) {
        console.warn(
          `⚠️ Contract utilization at ${contractUtilization.toFixed(1)}% for assignment ${professionalService.professionalCode} (Contract: ${contractValue.toLocaleString()}, Total Fees: ${newTotalFees.toLocaleString()})`
        );
      }
    }

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(body.projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Verify phase if provided
    if (body.phaseId) {
      if (!ObjectId.isValid(body.phaseId)) {
        return errorResponse('Valid phaseId is required if provided', 400);
      }
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(body.phaseId),
        projectId: new ObjectId(body.projectId),
      });
      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 404);
      }
    }

    // Verify activity if provided
    if (body.activityId) {
      if (!ObjectId.isValid(body.activityId)) {
        return errorResponse('Valid activityId is required if provided', 400);
      }
      const activity = await db.collection('professional_activities').findOne({
        _id: new ObjectId(body.activityId),
        professionalServiceId: new ObjectId(body.professionalServiceId),
        deletedAt: null,
      });
      if (!activity) {
        return errorResponse('Activity not found or does not belong to this professional service', 404);
      }
    }

    // Validate fee data
    const validation = validateProfessionalFee(body, professionalService);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    // Generate fee code
    const existingCount = await db.collection('professional_fees').countDocuments({
      professionalServiceId: new ObjectId(body.professionalServiceId),
      deletedAt: null,
    });

    const feeCode = generateFeeCode(
      professionalService.type,
      existingCount + 1
    );

    // Build fee document
    const fee = {
      professionalServiceId: new ObjectId(body.professionalServiceId),
      activityId: body.activityId && ObjectId.isValid(body.activityId) ? new ObjectId(body.activityId) : null,
      projectId: new ObjectId(body.projectId),
      phaseId: body.phaseId && ObjectId.isValid(body.phaseId) ? new ObjectId(body.phaseId) : null,
      feeCode,
      feeType: body.feeType,
      description: body.description || null,
      amount: parseFloat(body.amount),
      currency: body.currency || 'KES',
      paymentMethod: body.paymentMethod || null,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
      referenceNumber: body.referenceNumber || null,
      receiptUrl: body.receiptUrl || null,
      invoiceNumber: body.invoiceNumber || null,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
      invoiceUrl: body.invoiceUrl || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status || 'PENDING',
      approvedBy: null,
      approvedAt: null,
      approvalNotes: null,
      approvalChain: [],
      expenseId: null,
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert fee
    const result = await db.collection('professional_fees').insertOne(fee);

    // Update professional service assignment financial statistics
    const updatedAssignment = await db.collection('professional_services').findOneAndUpdate(
      { _id: new ObjectId(body.professionalServiceId) },
      {
        $inc: {
          totalFees: fee.amount,
          feesPending: fee.status === 'PENDING' ? fee.amount : 0,
        },
        $set: {
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Update committed cost: when fees are added, remaining commitment decreases
    // Only update if assignment is active (counts as commitment)
    if (professionalService.status === 'active' && professionalService.contractValue > 0) {
      try {
        const { updateCommittedCost } = await import('@/lib/financial-helpers');
        // The new fee amount reduces the remaining commitment
        await updateCommittedCost(
          body.projectId.toString(),
          fee.amount,
          'subtract'
        );
      } catch (financialError) {
        console.error('Error updating committed cost after fee creation:', financialError);
        // Don't fail the request, just log the error
      }
    }

    // Update activity if linked
    if (fee.activityId) {
      await db.collection('professional_activities').findOneAndUpdate(
        { _id: fee.activityId },
        {
          $set: {
            feeId: result.insertedId,
            feesCharged: fee.amount,
            paymentStatus: fee.status === 'PAID' ? 'paid' : 'pending',
            updatedAt: new Date(),
          },
        }
      );
    }

    // Create audit log
    const { createAuditLog } = await import('@/lib/audit-log');
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PROFESSIONAL_FEE',
      entityId: result.insertedId.toString(),
      projectId: body.projectId,
      changes: { created: fee },
    });

    // Populate response with related data
    const responseFee = {
      ...fee,
      _id: result.insertedId,
      professionalService: {
        _id: professionalService._id.toString(),
        professionalCode: professionalService.professionalCode,
        type: professionalService.type,
      },
      project: {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
    };

    return successResponse(
      responseFee,
      'Professional fee created successfully',
      201
    );
  } catch (error) {
    console.error('Create professional fee error:', error);
    return errorResponse('Failed to create professional fee', 500);
  }
}

