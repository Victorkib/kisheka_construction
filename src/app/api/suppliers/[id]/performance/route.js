/**
 * Supplier Performance API Routes
 * GET /api/suppliers/[id]/performance - Get supplier performance metrics
 * POST /api/suppliers/[id]/performance/update - Update supplier performance
 * GET /api/suppliers/performance/top - Get top performing suppliers
 * GET /api/suppliers/performance/dashboard - Performance dashboard data
 * 
 * Auth: PM, OWNER, ADMIN
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { 
  calculateSupplierPerformance, 
  updateSupplierPerformance,
  getTopPerformingSuppliers,
  PERFORMANCE_CATEGORIES 
} from '@/lib/supplier-performance';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/suppliers/[id]/performance
 * Get detailed performance metrics for a specific supplier
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_suppliers');
    if (!canView) {
      return errorResponse('Insufficient permissions to view supplier performance', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid supplier ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')) : null;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')) : null;
    const includeHistorical = searchParams.get('includeHistorical') !== 'false';

    // Validate date range
    if (startDate && endDate && startDate >= endDate) {
      return errorResponse('Start date must be before end date', 400);
    }

    // Get supplier performance metrics
    const performance = await calculateSupplierPerformance(id, {
      startDate,
      endDate,
      includeHistorical
    });

    return successResponse(performance, 'Supplier performance metrics retrieved successfully');

  } catch (error) {
    console.error('Get supplier performance error:', error);
    return errorResponse('Failed to retrieve supplier performance', 500);
  }
}

/**
 * POST /api/suppliers/[id]/performance/update
 * Update and recalculate supplier performance metrics
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_suppliers');
    if (!canManage) {
      return errorResponse('Insufficient permissions to update supplier performance', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid supplier ID', 400);
    }

    const db = await getDatabase();

    // Verify supplier exists and is active
    const supplier = await db.collection('suppliers').findOne({
      _id: new ObjectId(id),
      status: 'active'
    });

    if (!supplier) {
      return errorResponse('Supplier not found or inactive', 404);
    }

    // Update supplier performance
    const performance = await updateSupplierPerformance(id);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED_PERFORMANCE',
      entityType: 'SUPPLIER',
      entityId: id,
      changes: {
        performanceScore: performance.overallScore,
        grade: performance.grade,
        totalOrders: performance.totalOrders,
        categories: Object.keys(performance.categories).map(key => ({
          category: key,
          score: performance.categories[key].score
        }))
      },
      metadata: {
        performance,
        updatedBy: userProfile.name || userProfile.email
      }
    });

    return successResponse(performance, 'Supplier performance updated successfully');

  } catch (error) {
    console.error('Update supplier performance error:', error);
    return errorResponse('Failed to update supplier performance', 500);
  }
}
