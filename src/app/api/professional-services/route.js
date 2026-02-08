/**
 * Professional Services (Project Assignments) API Route
 * GET: List all professional service assignments with filtering and pagination
 * POST: Assign professional to project
 * 
 * GET /api/professional-services
 * POST /api/professional-services
 * Auth: All authenticated users (GET), OWNER/PM only (POST)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  validateProfessionalServices,
  generateProfessionalCode,
} from '@/lib/schemas/professional-services-schema';
import { PROFESSIONAL_SERVICE_STATUSES } from '@/lib/constants/professional-services-constants';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/professional-services
 * Returns professional service assignments with filtering, sorting, and pagination
 * Query params: projectId, libraryId, type, status, search, page, limit, sortBy, sortOrder
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
    const projectId = searchParams.get('projectId');
    const libraryId = searchParams.get('libraryId');
    const type = searchParams.get('type'); // 'architect' or 'engineer'
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'assignedDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (libraryId && ObjectId.isValid(libraryId)) {
      query.libraryId = new ObjectId(libraryId);
    }

    if (type && ['architect', 'engineer'].includes(type)) {
      query.type = type;
    }

    if (status && PROFESSIONAL_SERVICE_STATUSES.includes(status)) {
      query.status = status;
    }

    // Text search (will search in populated library data)
    if (search && search.trim()) {
      // We'll need to search in the library collection and match IDs
      const librarySearch = await db.collection('professional_services_library')
        .find({
          $or: [
            { name: { $regex: search.trim(), $options: 'i' } },
            { companyName: { $regex: search.trim(), $options: 'i' } },
            { firstName: { $regex: search.trim(), $options: 'i' } },
            { lastName: { $regex: search.trim(), $options: 'i' } },
          ],
          deletedAt: null,
        })
        .toArray();
      
      const libraryIds = librarySearch.map(l => l._id);
      if (libraryIds.length > 0) {
        query.libraryId = { $in: libraryIds };
      } else {
        // No matches, return empty result
        query.libraryId = { $in: [] };
      }
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const assignments = await db.collection('professional_services')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate library data
    const assignmentsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const library = await db.collection('professional_services_library').findOne({
          _id: assignment.libraryId,
        });

        const project = await db.collection('projects').findOne({
          _id: assignment.projectId,
        });

        const phase = assignment.phaseId
          ? await db.collection('phases').findOne({
              _id: assignment.phaseId,
            })
          : null;

        return {
          ...assignment,
          library: library
            ? {
                _id: library._id.toString(),
                name: library.name,
                type: library.type,
                companyName: library.companyName,
                firstName: library.firstName,
                lastName: library.lastName,
                email: library.email,
                phone: library.phone,
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
        };
      })
    );

    const total = await db.collection('professional_services').countDocuments(query);

    return successResponse({
      assignments: assignmentsWithDetails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get professional services error:', error);
    return errorResponse('Failed to retrieve professional services', 500);
  }
}

/**
 * POST /api/professional-services
 * Assigns a professional from library to a project
 * Auth: OWNER/PM only
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canAssign = await hasPermission(user.id, 'assign_professional_service');
    if (!canAssign) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can assign professionals to projects.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.libraryId || !ObjectId.isValid(body.libraryId)) {
      return errorResponse('Valid libraryId is required', 400);
    }

    if (!body.projectId || !ObjectId.isValid(body.projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();

    // Verify library entry exists
    const libraryEntry = await db.collection('professional_services_library').findOne({
      _id: new ObjectId(body.libraryId),
      deletedAt: null,
      isActive: true,
    });

    if (!libraryEntry) {
      return errorResponse('Professional not found in library or is inactive', 404);
    }

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(body.projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Check if already assigned to this project (active assignment)
    const existingAssignment = await db.collection('professional_services').findOne({
      libraryId: new ObjectId(body.libraryId),
      projectId: new ObjectId(body.projectId),
      status: 'active',
      deletedAt: null,
    });

    if (existingAssignment) {
      return errorResponse('Professional is already actively assigned to this project', 400);
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

    // Validate assignment data
    const assignmentData = {
      libraryId: new ObjectId(body.libraryId),
      projectId: new ObjectId(body.projectId),
      phaseId: body.phaseId && ObjectId.isValid(body.phaseId) ? new ObjectId(body.phaseId) : null,
      serviceCategory: body.serviceCategory || 'construction', // Default to construction
      type: libraryEntry.type, // Denormalized
      assignedDate: body.assignedDate ? new Date(body.assignedDate) : new Date(),
      contractType: body.contractType || libraryEntry.defaultContractType || 'full_service',
      contractValue: parseFloat(body.contractValue) || 0,
      paymentSchedule: body.paymentSchedule || libraryEntry.defaultPaymentSchedule || 'monthly',
      visitFrequency: body.visitFrequency || libraryEntry.defaultVisitFrequency || null,
      contractStartDate: body.contractStartDate ? new Date(body.contractStartDate) : new Date(),
      contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : null,
      contractDocumentUrl: body.contractDocumentUrl || null,
      paymentTerms: body.paymentTerms || null,
      milestonePayments: body.milestonePayments || [],
      status: body.status || 'active',
      notes: body.notes || null,
    };

    // Validate using schema
    const validation = validateProfessionalServices(assignmentData, libraryEntry);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    // Generate professional code
    const existingCount = await db.collection('professional_services').countDocuments({
      projectId: new ObjectId(body.projectId),
      type: libraryEntry.type,
      deletedAt: null,
    });

    const professionalCode = generateProfessionalCode(
      project.projectCode,
      libraryEntry.type,
      existingCount + 1
    );

    // Build assignment document
    const assignment = {
      ...assignmentData,
      professionalCode,
      totalFees: 0,
      feesPaid: 0,
      feesPending: 0,
      expensesIncurred: 0,
      totalActivities: 0,
      totalSiteVisits: 0,
      totalInspections: 0,
      documentsUploaded: 0,
      revisionsMade: 0,
      issuesIdentified: 0,
      issuesResolved: 0,
      lastActivityDate: null,
      isActive: assignmentData.status === 'active',
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert assignment
    const result = await db.collection('professional_services').insertOne(assignment);

    // Update library usage count
    await db.collection('professional_services_library').findOneAndUpdate(
      { _id: new ObjectId(body.libraryId) },
      {
        $inc: { usageCount: 1 },
        $set: {
          lastUsedAt: new Date(),
          lastUsedBy: new ObjectId(userProfile._id),
          lastUsedInProject: new ObjectId(body.projectId),
        },
      }
    );

    // Update committed cost (add contract value to committed costs)
    if (assignment.contractValue > 0 && assignment.status === 'active') {
      try {
        const { updateCommittedCost } = await import('@/lib/financial-helpers');
        await updateCommittedCost(
          body.projectId.toString(),
          assignment.contractValue,
          'add'
        );
      } catch (financialError) {
        console.error('Error updating committed cost after assignment creation:', financialError);
        // Don't fail the request, just log the error
      }
    }

    // Create audit log
    const { createAuditLog } = await import('@/lib/audit-log');
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PROFESSIONAL_SERVICES',
      entityId: result.insertedId.toString(),
      changes: { created: assignment },
    });

    // Populate response with library and project data
    const responseAssignment = {
      ...assignment,
      _id: result.insertedId,
      library: {
        _id: libraryEntry._id.toString(),
        name: libraryEntry.name,
        type: libraryEntry.type,
      },
      project: {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
    };

    return successResponse(
      responseAssignment,
      'Professional assigned to project successfully',
      201
    );
  } catch (error) {
    console.error('Create professional service assignment error:', error);
    return errorResponse('Failed to assign professional to project', 500);
  }
}

