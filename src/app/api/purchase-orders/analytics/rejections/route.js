/**
 * Purchase Order Rejection Analytics API Route
 * GET: Get analytics and statistics for rejected purchase orders
 * 
 * GET /api/purchase-orders/analytics/rejections
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { getProjectContext, createProjectFilter } from '@/lib/middleware/project-context';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/purchase-orders/analytics/rejections
 * Get rejection analytics and statistics
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

    // Check permission
    const canView = await hasPermission(user.id, 'view_purchase_orders');
    if (!canView) {
      return errorResponse('Insufficient permissions to view purchase orders', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Get and validate project context (consistent with main purchase orders API)
    const projectContext = await getProjectContext(request, user.id);
    
    // If projectId is provided, validate access
    if (projectContext.projectId && !projectContext.hasAccess) {
      return errorResponse(projectContext.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();

    // Build query with project filter (use context projectId if not in query params)
    const activeProjectId = projectId || projectContext.projectId;
    const query = createProjectFilter(activeProjectId, {
      status: { $in: ['order_rejected', 'order_partially_responded'] },
      deletedAt: null,
    });

    // Get all rejected orders
    const rejectedOrders = await db.collection('purchase_orders')
      .find(query)
      .toArray();

    // Calculate statistics
    const totalRejections = rejectedOrders.length;
    
    // Count retryable vs non-retryable
    const retryableCount = rejectedOrders.filter(po => po.isRetryable === true).length;
    const nonRetryableCount = rejectedOrders.filter(po => po.isRetryable === false).length;
    
    // Count needing reassignment
    const needsReassignmentCount = rejectedOrders.filter(po => po.needsReassignment === true).length;
    
    // Calculate total value
    const totalValue = rejectedOrders.reduce((sum, po) => sum + (po.totalCost || 0), 0);
    
    // Group by rejection reason
    const rejectionReasonCounts = {};
    rejectedOrders.forEach(po => {
      const reason = po.rejectionReason || 'other';
      rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] || 0) + 1;
    });
    
    // Group by supplier
    const supplierRejectionCounts = {};
    rejectedOrders.forEach(po => {
      const supplierId = po.supplierId?.toString() || 'unknown';
      const supplierName = po.supplierName || 'Unknown';
      if (!supplierRejectionCounts[supplierId]) {
        supplierRejectionCounts[supplierId] = {
          name: supplierName,
          count: 0,
          totalValue: 0
        };
      }
      supplierRejectionCounts[supplierId].count += 1;
      supplierRejectionCounts[supplierId].totalValue += (po.totalCost || 0);
    });
    
    // Get top suppliers by rejection count
    const topSuppliersByRejections = Object.values(supplierRejectionCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Calculate rejection rate by project (if projectId not specified)
    let projectRejectionRates = [];
    if (!projectId) {
      const projectStats = {};
      rejectedOrders.forEach(po => {
        const projId = po.projectId?.toString() || 'unknown';
        if (!projectStats[projId]) {
          projectStats[projId] = {
            projectId: projId,
            rejectionCount: 0,
            totalValue: 0
          };
        }
        projectStats[projId].rejectionCount += 1;
        projectStats[projId].totalValue += (po.totalCost || 0);
      });
      
      // Get project names
      const projectIds = Object.keys(projectStats).filter(id => ObjectId.isValid(id));
      if (projectIds.length > 0) {
        const projects = await db.collection('projects')
          .find({ _id: { $in: projectIds.map(id => new ObjectId(id)) } })
          .toArray();
        
        projectRejectionRates = Object.values(projectStats)
          .map(stat => {
            const project = projects.find(p => p._id.toString() === stat.projectId);
            return {
              projectId: stat.projectId,
              projectName: project?.projectName || 'Unknown',
              rejectionCount: stat.rejectionCount,
              totalValue: stat.totalValue
            };
          })
          .sort((a, b) => b.rejectionCount - a.rejectionCount)
          .slice(0, 5);
      }
    }
    
    // Calculate trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRejections = rejectedOrders.filter(po => {
      const rejectionDate = po.supplierResponseDate || po.updatedAt;
      return rejectionDate && new Date(rejectionDate) >= thirtyDaysAgo;
    });
    
    const rejectionTrend = {
      last30Days: recentRejections.length,
      previous30Days: 0 // Would need historical data to calculate
    };

    return successResponse({
      totalRejections,
      retryableCount,
      nonRetryableCount,
      needsReassignmentCount,
      totalValue,
      rejectionReasonCounts,
      topSuppliersByRejections,
      projectRejectionRates,
      rejectionTrend,
      averageRejectionValue: totalRejections > 0 ? totalValue / totalRejections : 0
    }, 'Rejection analytics retrieved successfully');
  } catch (error) {
    console.error('Rejection analytics error:', error);
    return errorResponse('Failed to retrieve rejection analytics', 500);
  }
}

