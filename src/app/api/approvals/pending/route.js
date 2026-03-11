/**
 * Unified Pending Approvals API Route
 * GET: Get all pending approvals across all types for a specific project
 * 
 * GET /api/approvals/pending?projectId={projectId}
 * Auth: PM, OWNER, ACCOUNTANT
 * 
 * This endpoint provides a unified view of all pending approvals across:
 * - Materials
 * - Expenses
 * - Initial Expenses
 * - Material Requests
 * - Labour Entries
 * - Professional Fees
 * - Professional Activities
 * - Budget Reallocations
 * - Purchase Order Modifications
 * - Contingency Draws
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  APPROVAL_STATUS_MAP,
  getPendingApprovalStatuses,
} from '@/lib/status-constants';
import { validateProjectAccess } from '@/lib/middleware/project-context';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/approvals/pending
 * Returns all pending approvals for a specific project
 * 
 * Query Parameters:
 * - projectId (required): Project ID to filter approvals
 * - type (optional): Filter by approval type (materials, expenses, etc.)
 * - page (optional): Pagination page number (default: 1)
 * - limit (optional): Items per page (default: 50)
 * - sortBy (optional): Sort field (default: createdAt)
 * - sortOrder (optional): Sort order 'asc' or 'desc' (default: desc)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission to view approvals
    const canViewApprovals = await hasPermission(user.id, 'view_approvals');
    if (!canViewApprovals) {
      return errorResponse('Insufficient permissions. You do not have permission to view approvals.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const typeFilter = searchParams.get('type'); // Optional: filter by specific type
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Validate projectId is provided (required for multi-project system)
    if (!projectId) {
      return errorResponse('Project ID is required. Please provide projectId query parameter.', 400);
    }

    if (!ObjectId.isValid(projectId)) {
      return errorResponse('Invalid project ID format', 400);
    }

    // Validate project access
    const accessResult = await validateProjectAccess(userProfile._id, projectId);
    
    if (!accessResult.hasAccess) {
      return errorResponse(accessResult.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();
    const projectObjectId = new ObjectId(projectId);

    // Base project filter
    const projectFilter = { projectId: projectObjectId, deletedAt: null };

    // Get project name for response
    const project = await db.collection('projects').findOne({
      _id: projectObjectId,
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Define all approval types to query
    const approvalTypes = [
      { name: 'materials', collection: 'materials', titleField: 'name', amountField: 'totalCost' },
      { name: 'expenses', collection: 'expenses', titleField: 'description', amountField: 'amount' },
      { name: 'initial_expenses', collection: 'initial_expenses', titleField: 'itemName', amountField: 'amount' },
      { name: 'material_requests', collection: 'material_requests', titleField: 'materialName', amountField: 'estimatedCost' },
      { name: 'labour_entries', collection: 'labour_entries', titleField: 'taskDescription', amountField: 'totalCost' },
      { name: 'professional_fees', collection: 'professional_fees', titleField: 'description', amountField: 'amount' },
      { name: 'professional_activities', collection: 'professional_activities', titleField: 'activityType', amountField: 'feesCharged' },
      { name: 'budget_reallocations', collection: 'budget_reallocations', titleField: 'reason', amountField: 'amount' },
    ];

    // Filter by type if specified
    const typesToQuery = typeFilter
      ? approvalTypes.filter((t) => t.name === typeFilter)
      : approvalTypes;

    if (typesToQuery.length === 0) {
      return errorResponse(`Invalid approval type: ${typeFilter}`, 400);
    }

    // Query all approval types in parallel
    const approvalQueries = typesToQuery.map(async (typeConfig) => {
      const { name, collection, titleField, amountField } = typeConfig;
      const pendingStatuses = getPendingApprovalStatuses(name);

      if (pendingStatuses.length === 0) {
        return {
          type: name,
          count: 0,
          items: [],
        };
      }

      // Build query
      const query = {
        ...projectFilter,
        status: { $in: pendingStatuses },
      };

      // Special handling for purchase orders (modifications)
      if (name === 'purchase_orders') {
        query.status = 'order_modified';
      }

      // Get count
      const count = await db.collection(collection).countDocuments(query);

      // Get items with pagination
      const skip = (page - 1) * limit;
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const items = await db
        .collection(collection)
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      // Transform items to unified format
      const transformedItems = items.map((item) => {
        // Get submitted by info
        const submittedBy = item.submittedBy || item.requestedBy || item.createdBy;
        const submittedByName = item.submittedByName || item.requestedByName || item.createdByName || 'Unknown';

        // Format dates
        const submittedAt = item.submittedAt || item.requestedAt || item.createdAt || item.date;

        return {
          id: item._id.toString(),
          type: name,
          title: item[titleField] || item.materialName || item.expenseCode || item.feeCode || item.activityCode || 'N/A',
          description: item.description || item.reason || item.taskDescription || '',
          amount: item[amountField] || 0,
          currency: item.currency || 'KES',
          projectId: item.projectId?.toString() || projectId,
          projectName: project.projectName || 'Unknown Project',
          submittedBy: submittedBy?.toString() || item.submittedBy?._id?.toString() || '',
          submittedByName: submittedByName,
          submittedAt: submittedAt,
          status: item.status,
          urgency: item.urgency || 'medium',
          // Type-specific fields
          ...(name === 'materials' && {
            quantity: item.quantity || item.quantityPurchased || 0,
            unit: item.unit || '',
            supplierName: item.supplierName || item.supplier || 'N/A',
          }),
          ...(name === 'expenses' && {
            category: item.category || 'N/A',
            vendor: item.vendor || 'N/A',
            expenseCode: item.expenseCode || '',
          }),
          ...(name === 'material_requests' && {
            quantityNeeded: item.quantityNeeded || 0,
            unit: item.unit || '',
            requestNumber: item.requestNumber || '',
          }),
          ...(name === 'labour_entries' && {
            workerName: item.workerName || 'N/A',
            totalHours: item.totalHours || 0,
            entryNumber: item.entryNumber || '',
          }),
          ...(name === 'professional_fees' && {
            feeType: item.feeType || 'N/A',
            feeCode: item.feeCode || '',
          }),
          ...(name === 'professional_activities' && {
            activityType: item.activityType || 'N/A',
            activityCode: item.activityCode || '',
            activityDate: item.activityDate || '',
          }),
          ...(name === 'budget_reallocations' && {
            reallocationType: item.reallocationType || 'N/A',
            fromPhaseId: item.fromPhaseId?.toString() || null,
            toPhaseId: item.toPhaseId?.toString() || null,
          }),
          // Approval endpoints
          approveUrl: getApproveUrl(name, item._id.toString()),
          rejectUrl: getRejectUrl(name, item._id.toString()),
        };
      });

      return {
        type: name,
        count,
        items: transformedItems,
      };
    });

    // Execute all queries in parallel
    const results = await Promise.all(approvalQueries);

    // Calculate totals
    const totalCount = results.reduce((sum, result) => sum + result.count, 0);
    const allItems = results.flatMap((result) => result.items);

    // Sort all items if needed (for unified view)
    if (!typeFilter) {
      allItems.sort((a, b) => {
        const aValue = a[sortBy] || a.submittedAt || new Date(0);
        const bValue = b[sortBy] || b.submittedAt || new Date(0);
        const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Paginate unified results
    const skip = (page - 1) * limit;
    const paginatedItems = allItems.slice(skip, skip + limit);

    // Build counts by type
    const counts = {};
    results.forEach((result) => {
      counts[result.type] = result.count;
    });
    counts.total = totalCount;

    return successResponse(
      {
        approvals: paginatedItems,
        counts,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
        project: {
          id: projectId,
          name: project.projectName || 'Unknown Project',
        },
      },
      'Pending approvals retrieved successfully'
    );
  } catch (error) {
    console.error('Get pending approvals error:', error);
    return errorResponse('Failed to retrieve pending approvals', 500);
  }
}

/**
 * Get approval URL for a specific type
 * @param {string} type - Approval type
 * @param {string} id - Item ID
 * @returns {string} Approval URL
 */
function getApproveUrl(type, id) {
  const urlMap = {
    materials: `/api/materials/${id}/approve`,
    expenses: `/api/expenses/${id}/approve`,
    initial_expenses: `/api/initial-expenses/${id}/approve`,
    material_requests: `/api/material-requests/${id}/approve`,
    labour_entries: `/api/labour/entries/${id}/approve`,
    professional_fees: `/api/professional-fees/${id}/approve`,
    professional_activities: `/api/professional-activities/${id}/approve`,
    budget_reallocations: `/api/budget-reallocations/${id}/approve`,
    purchase_orders: `/api/purchase-orders/${id}/approve-modification`,
  };

  return urlMap[type] || null;
}

/**
 * Get rejection URL for a specific type
 * @param {string} type - Approval type
 * @param {string} id - Item ID
 * @returns {string} Rejection URL
 */
function getRejectUrl(type, id) {
  const urlMap = {
    materials: `/api/materials/${id}/reject`,
    expenses: `/api/expenses/${id}/reject`,
    initial_expenses: `/api/initial-expenses/${id}/approve`, // Uses approve endpoint with approved: false
    material_requests: `/api/material-requests/${id}/reject`,
    labour_entries: null, // Labour entries may not have reject endpoint
    professional_fees: `/api/professional-fees/${id}/reject`,
    professional_activities: `/api/professional-activities/${id}/reject`,
    budget_reallocations: `/api/budget-reallocations/${id}/reject`,
    purchase_orders: null, // Purchase order modifications handled differently
  };

  return urlMap[type] || null;
}
