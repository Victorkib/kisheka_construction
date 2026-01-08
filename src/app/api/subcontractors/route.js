/**
 * Subcontractors API Route
 * GET: List subcontractors (optionally filtered by project, phase, status, type)
 * POST: Create new subcontractor assignment (PM, OWNER only)
 * 
 * GET /api/subcontractors?projectId=xxx&phaseId=xxx&status=xxx&subcontractorType=xxx
 * POST /api/subcontractors
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createSubcontractor, validateSubcontractor, SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES } from '@/lib/schemas/subcontractor-schema';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';

/**
 * GET /api/subcontractors
 * Returns subcontractors, optionally filtered by projectId, phaseId, status, subcontractorType
 * Auth: All authenticated users
 * Query params: projectId (optional), phaseId (optional), status (optional), subcontractorType (optional), page (optional), limit (optional)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const db = await getDatabase();

    const query = { deletedAt: null };

    // Filters
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const status = searchParams.get('status');
    const subcontractorType = searchParams.get('subcontractorType');

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (status && SUBCONTRACTOR_STATUSES.includes(status)) {
      query.status = status;
    }

    if (subcontractorType && SUBCONTRACTOR_TYPES.includes(subcontractorType)) {
      query.subcontractorType = subcontractorType;
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const subcontractors = await db.collection('subcontractors')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate phase names for better display
    const phaseIds = [...new Set(subcontractors.map(sub => sub.phaseId?.toString()).filter(Boolean))];
    const phases = phaseIds.length > 0 
      ? await db.collection('phases').find({
          _id: { $in: phaseIds.map(id => new ObjectId(id)) },
          deletedAt: null
        }).toArray()
      : [];
    
    const phaseMap = {};
    phases.forEach(phase => {
      phaseMap[phase._id.toString()] = phase.phaseName || phase.name || 'Unknown';
    });

    // Add phase names to subcontractors
    const subcontractorsWithPhases = subcontractors.map(sub => ({
      ...sub,
      phaseName: sub.phaseId ? phaseMap[sub.phaseId.toString()] : 'Unknown'
    }));

    const total = await db.collection('subcontractors').countDocuments(query);

    return successResponse({
      subcontractors: subcontractorsWithPhases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Subcontractors retrieved successfully');
  } catch (error) {
    console.error('Get subcontractors error:', error);
    return errorResponse('Failed to retrieve subcontractors', 500);
  }
}

/**
 * POST /api/subcontractors
 * Creates a new subcontractor assignment for a phase
 * Auth: PM, OWNER only
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

    const hasCreatePermission = await hasPermission(user.id, 'create_subcontractor');
    if (!hasCreatePermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can create subcontractor assignments.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      phaseId,
      subcontractorName,
      subcontractorType,
      contactPerson,
      phone,
      email,
      contractValue,
      contractType,
      startDate,
      endDate,
      paymentSchedule,
      status,
      performance,
      notes
    } = body;

    // Validation
    if (!projectId) {
      return errorResponse('Project ID is required', 400);
    }

    if (!ObjectId.isValid(projectId)) {
      return errorResponse('Invalid project ID', 400);
    }

    if (!phaseId) {
      return errorResponse('Phase ID is required', 400);
    }

    if (!ObjectId.isValid(phaseId)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();

    // Verify phase exists and belongs to project
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      projectId: new ObjectId(projectId),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found or does not belong to this project', 400);
    }

    // Prepare subcontractor data for validation
    const subcontractorData = {
      projectId,
      phaseId,
      subcontractorName,
      subcontractorType,
      contactPerson,
      phone,
      email,
      contractValue,
      contractType,
      startDate,
      endDate,
      paymentSchedule: paymentSchedule || [],
      status: status || 'pending',
      performance,
      notes
    };

    // Validate using schema
    const validation = validateSubcontractor(subcontractorData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Create subcontractor object
    const subcontractor = createSubcontractor(
      {
        subcontractorName,
        subcontractorType,
        contactPerson,
        phone,
        email,
        contractValue,
        contractType,
        startDate,
        endDate,
        paymentSchedule: paymentSchedule || [],
        status: status || 'pending',
        performance,
        notes
      },
      projectId,
      phaseId,
      userProfile._id
    );

    // Insert subcontractor
    const result = await db.collection('subcontractors').insertOne(subcontractor);

    const insertedSubcontractor = { ...subcontractor, _id: result.insertedId };

    // Recalculate phase spending
    try {
      await recalculatePhaseSpending(phaseId);
    } catch (phaseError) {
      console.error('Error recalculating phase spending after subcontractor creation:', phaseError);
      // Don't fail the request, just log the error
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'SUBCONTRACTOR',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { created: insertedSubcontractor },
    });

    return successResponse(insertedSubcontractor, 'Subcontractor created successfully', 201);
  } catch (error) {
    console.error('Create subcontractor error:', error);
    return errorResponse('Failed to create subcontractor', 500);
  }
}


