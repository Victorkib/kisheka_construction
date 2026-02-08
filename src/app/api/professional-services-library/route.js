/**
 * Professional Services Library API Route
 * GET: List all professionals in library with filtering and pagination
 * POST: Create new professional in library (OWNER only)
 * 
 * GET /api/professional-services-library
 * POST /api/professional-services-library
 * Auth: All authenticated users (GET), OWNER only (POST)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { PROFESSIONAL_TYPES } from '@/lib/constants/professional-services-constants';

/**
 * GET /api/professional-services-library
 * Returns professionals in library with filtering, sorting, and pagination
 * Query params: type, isCommon, isActive, search, page, limit, sortBy, sortOrder
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'architect' or 'engineer'
    const isCommon = searchParams.get('isCommon');
    const isActive = searchParams.get('isActive');
    const specialization = searchParams.get('specialization'); // For engineers
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };

    if (type && PROFESSIONAL_TYPES.includes(type)) {
      query.type = type;
    }

    if (isCommon === 'true') {
      query.isCommon = true;
    }

    if (isActive === 'true' || isActive === null) {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }

    if (specialization) {
      query.specialization = specialization;
    }

    // Text search
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { companyName: { $regex: search.trim(), $options: 'i' } },
        { firstName: { $regex: search.trim(), $options: 'i' } },
        { lastName: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const professionals = await db.collection('professional_services_library')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('professional_services_library').countDocuments(query);

    return successResponse({
      professionals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get professional services library error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return errorResponse(
      `Failed to retrieve professional services library: ${error.message}`,
      500
    );
  }
}

/**
 * POST /api/professional-services-library
 * Creates a new professional in library
 * Auth: OWNER only
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_professional_services_library');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER can manage professional services library.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    
    // Validate data - import validation function only when needed
    const { validateProfessionalServicesLibrary } = await import('@/lib/schemas/professional-services-library-schema');
    const validation = validateProfessionalServicesLibrary(body);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    const db = await getDatabase();

    // Check if professional with same name already exists (case-insensitive)
    const existing = await db.collection('professional_services_library').findOne({
      name: { $regex: new RegExp(`^${body.name.trim()}$`, 'i') },
      type: body.type,
      deletedAt: null,
    });

    if (existing) {
      return errorResponse(`Professional with this name and type already exists in the library`, 400);
    }

    // Build professional library document
    const professional = {
      name: body.name.trim(),
      type: body.type,
      description: body.description?.trim() || '',
      companyName: body.companyName?.trim() || null,
      firstName: body.firstName?.trim() || null,
      lastName: body.lastName?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      registrationNumber: body.registrationNumber?.trim() || null,
      licenseNumber: body.licenseNumber?.trim() || null,
      specialization: body.specialization || null,
      defaultContractType: body.defaultContractType || null,
      defaultPaymentSchedule: body.defaultPaymentSchedule || null,
      defaultVisitFrequency: body.defaultVisitFrequency || null,
      defaultHourlyRate: body.defaultHourlyRate ? parseFloat(body.defaultHourlyRate) : null,
      defaultPerVisitRate: body.defaultPerVisitRate ? parseFloat(body.defaultPerVisitRate) : null,
      defaultMonthlyRetainer: body.defaultMonthlyRetainer ? parseFloat(body.defaultMonthlyRetainer) : null,
      usageCount: 0,
      lastUsedAt: null,
      lastUsedBy: null,
      lastUsedInProject: null,
      isActive: body.isActive !== undefined ? body.isActive : true,
      isCommon: body.isCommon || false,
      tags: Array.isArray(body.tags) ? body.tags.filter(t => t && t.trim()).map(t => t.trim()) : [],
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert
    const result = await db.collection('professional_services_library').insertOne(professional);

    // Create audit log
    const { createAuditLog } = await import('@/lib/audit-log');
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PROFESSIONAL_SERVICES_LIBRARY',
      entityId: result.insertedId.toString(),
      changes: { created: professional },
    });

    return successResponse(
      { ...professional, _id: result.insertedId },
      'Professional added to library successfully',
      201
    );
  } catch (error) {
    console.error('Create professional services library error:', error);
    return errorResponse('Failed to add professional to library', 500);
  }
}

