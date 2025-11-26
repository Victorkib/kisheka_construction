/**
 * Expenses API Route
 * GET: List all expenses with filters
 * POST: Create new expense
 * 
 * GET /api/expenses
 * POST /api/expenses
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
 * GET /api/expenses
 * Returns expenses with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: projectId, category, status, vendor, search, page, limit, sortBy, sortOrder, startDate, endDate
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
    const vendor = searchParams.get('vendor');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'date';
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
      query.$or = [
        { status: 'ARCHIVED' },
        { deletedAt: { $ne: null } },
      ];
    } else if (archived === 'false' || !archived) {
      // Default: exclude archived expenses
      query.deletedAt = null;
      if (!status) {
        query.status = { $ne: 'ARCHIVED' };
      }
    }

    if (vendor) {
      query.vendor = { $regex: vendor, $options: 'i' };
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { vendor: { $regex: search, $options: 'i' } },
        { expenseCode: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const expenses = await db
      .collection('expenses')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('expenses').countDocuments(query);

    return successResponse(
      {
        expenses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      'Expenses retrieved successfully'
    );
  } catch (error) {
    console.error('Get expenses error:', error);
    return errorResponse('Failed to retrieve expenses', 500);
  }
}

/**
 * POST /api/expenses
 * Creates a new expense entry
 * Auth: CLERK, PM, OWNER
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasCreatePermission = await hasPermission(user.id, 'create_expense');
    if (!hasCreatePermission) {
      return errorResponse('Insufficient permissions. Only CLERK, PM, and OWNER can create expenses.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      amount,
      category,
      description,
      vendor,
      date,
      paymentMethod,
      referenceNumber,
      receiptFileUrl,
      notes,
      currency = 'KES',
    } = body;

    // Validation
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!amount || amount <= 0) {
      return errorResponse('Amount must be greater than 0', 400);
    }

    if (!category || category.trim().length === 0) {
      return errorResponse('Category is required', 400);
    }

    if (!description || description.trim().length === 0) {
      return errorResponse('Description is required', 400);
    }

    if (!vendor || vendor.trim().length === 0) {
      return errorResponse('Vendor is required', 400);
    }

    // Valid expense categories
    const validCategories = [
      'equipment_rental',
      'transport',
      'accommodation',
      'utilities',
      'safety',
      'permits',
      'training',
      'excavation',
      'earthworks',
      'construction_services',
      'other',
    ];

    if (!validCategories.includes(category)) {
      return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`, 400);
    }

    // Get user profile
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Generate expense code
    const expenseCount = await db.collection('expenses').countDocuments({ projectId: new ObjectId(projectId) });
    const expenseCode = `EXP-${projectId.toString().substring(0, 8)}-${String(expenseCount + 1).padStart(4, '0')}`;

    // Build expense document
    const expense = {
      projectId: new ObjectId(projectId),
      expenseCode,
      amount: parseFloat(amount),
      currency: currency || 'KES',
      category: category.trim(),
      description: description.trim(),
      vendor: vendor.trim(),
      date: date ? new Date(date) : new Date(),
      status: 'PENDING', // Initial status - requires approval
      paymentMethod: paymentMethod || 'CASH',
      referenceNumber: referenceNumber?.trim() || null,
      receiptFileUrl: receiptFileUrl || null,
      submittedBy: {
        userId: new ObjectId(userProfile._id),
        name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
        email: userProfile.email,
      },
      approvedBy: null,
      approvalNotes: null,
      approvalChain: [],
      notes: notes?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert expense
    const result = await db.collection('expenses').insertOne(expense);

    const insertedExpense = { ...expense, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'EXPENSE',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { created: insertedExpense },
    });

    return successResponse(insertedExpense, 'Expense created successfully', 201);
  } catch (error) {
    console.error('Create expense error:', error);
    return errorResponse('Failed to create expense', 500);
  }
}

