/**
 * Initial Expenses API Route
 * GET: List all initial expenses with filters
 * POST: Create new initial expense
 * 
 * GET /api/initial-expenses
 * POST /api/initial-expenses
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/initial-expenses
 * Returns initial expenses with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: projectId, category, status, search, page, limit, sortBy, sortOrder, startDate, endDate
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
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'datePaid';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = {};

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    // Archive filter: if archived=true, show only archived; if archived=false or not set, exclude archived
    const archived = searchParams.get('archived');
    if (archived === 'true') {
      query.status = 'deleted';
    } else if (archived === 'false' || !archived) {
      // Default: exclude archived initial expenses
      if (!status) {
        query.status = { $ne: 'deleted' };
      }
    }

    if (startDate || endDate) {
      query.datePaid = {};
      if (startDate) {
        query.datePaid.$gte = new Date(startDate);
      }
      if (endDate) {
        query.datePaid.$lte = new Date(endDate);
      }
    }

    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } },
        { expenseCode: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const expenses = await db
      .collection('initial_expenses')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('initial_expenses').countDocuments(query);

    // Calculate totals
    const totals = await db
      .collection('initial_expenses')
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            approvedAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0],
              },
            },
          },
        },
      ])
      .toArray();

    return successResponse({
      expenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      totals: totals[0] || { totalAmount: 0, approvedAmount: 0 },
    });
  } catch (error) {
    console.error('Get initial expenses error:', error);
    return errorResponse('Failed to retrieve initial expenses', 500);
  }
}

/**
 * POST /api/initial-expenses
 * Creates a new initial expense
 * Auth: CLERK, PM, OWNER
 * Body: projectId, category, itemName, amount, supplier, receiptNumber, receiptFileUrl, supportingDocuments, datePaid, notes
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_initial_expense');
    if (!canCreate) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['site_clerk', 'pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only CLERK, PM, and OWNER can create initial expenses.',
          403
        );
      }
    }

    const body = await request.json();
    const {
      projectId,
      category,
      itemName,
      amount,
      supplier,
      receiptNumber,
      receiptFileUrl,
      supportingDocuments = [],
      datePaid,
      notes,
    } = body;

    // Validation
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!category) {
      return errorResponse('Category is required', 400);
    }

    const validCategories = [
      'land',
      'transfer_fees',
      'county_fees',
      'permits',
      'approvals',
      'boreholes',
      'electricity',
      'other',
    ];
    if (!validCategories.includes(category)) {
      return errorResponse('Invalid category', 400);
    }

    if (!itemName || itemName.trim().length === 0) {
      return errorResponse('Item name is required', 400);
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return errorResponse('Valid amount is required', 400);
    }

    if (!datePaid) {
      return errorResponse('Date paid is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db
      .collection('projects')
      .findOne({ _id: new ObjectId(projectId) });
    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Generate expense code
    const count = await db.collection('initial_expenses').countDocuments({
      projectId: new ObjectId(projectId),
    });
    const expenseCode = `INIT-${project.projectCode}-${String(count + 1).padStart(4, '0')}`;

    // Determine status based on amount (auto-approve if < 100k, require approval if >= 100k)
    const APPROVAL_THRESHOLD = 100000;
    const status = amount >= APPROVAL_THRESHOLD ? 'pending_approval' : 'approved';

    const initialExpense = {
      projectId: new ObjectId(projectId),
      expenseCode,
      category,
      itemName: itemName.trim(),
      amount: parseFloat(amount),
      supplier: supplier?.trim() || '',
      receiptNumber: receiptNumber?.trim() || '',
      receiptFileUrl: receiptFileUrl || null,
      supportingDocuments: Array.isArray(supportingDocuments)
        ? supportingDocuments
        : [],
      datePaid: new Date(datePaid),
      enteredBy: new ObjectId(userProfile._id),
      approvedBy: status === 'approved' ? new ObjectId(userProfile._id) : null,
      approvalNotes: status === 'approved' ? 'Auto-approved (amount < 100k)' : '',
      status,
      notes: notes?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .collection('initial_expenses')
      .insertOne(initialExpense);
    const insertedExpense = { ...initialExpense, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'INITIAL_EXPENSE',
      entityId: result.insertedId.toString(),
      changes: { created: insertedExpense },
    });

    return successResponse(
      insertedExpense,
      'Initial expense created successfully',
      201
    );
  } catch (error) {
    console.error('Create initial expense error:', error);
    return errorResponse('Failed to create initial expense', 500);
  }
}

