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
import { getProjectContext, createProjectFilter } from '@/lib/middleware/project-context';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';

/**
 * GET /api/expenses
 * Returns expenses with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: projectId, category, phaseId, status, vendor, search, page, limit, sortBy, sortOrder, startDate, endDate
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const phaseId = searchParams.get('phaseId');
    const status = searchParams.get('status');
    const vendor = searchParams.get('vendor');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const isIndirectCost = searchParams.get('isIndirectCost'); // NEW: Filter by indirect costs
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Get and validate project context
    const projectContext = await getProjectContext(request, user.id);
    
    // If projectId is provided, validate access
    if (projectContext.projectId && !projectContext.hasAccess) {
      return errorResponse(projectContext.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();

    // Build query with project filter
    const query = createProjectFilter(projectContext.projectId, {});

    if (category) {
      query.category = category;
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (status) {
      query.status = status;
    }
    
    // Filter by indirect costs
    if (isIndirectCost !== null && isIndirectCost !== undefined) {
      query.isIndirectCost = isIndirectCost === 'true';
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
      phaseId,
      description,
      vendor,
      date,
      paymentMethod,
      referenceNumber,
      receiptFileUrl,
      notes,
      currency = 'KES',
      isIndirectCost, // NEW: Flag to mark expense as indirect cost
      indirectCostCategory, // NEW: Category for indirect costs (utilities, siteOverhead, transportation, safetyCompliance)
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

    // PhaseId is now required - validate using centralized helper
    const { validatePhaseForExpense } = await import('@/lib/phase-validation-helpers');
    const phaseValidation = await validatePhaseForExpense(phaseId, projectId);
    
    if (!phaseValidation.isValid) {
      return errorResponse(phaseValidation.error, phaseValidation.phase ? 400 : 404);
    }
    
    const phase = phaseValidation.phase;

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
    
    // Auto-suggest isIndirectCost based on category
    // Categories that are typically indirect costs
    const indirectCostCategories = ['utilities', 'transport', 'safety'];
    const suggestedIsIndirectCost = indirectCostCategories.includes(category);
    
    // Map category to indirectCostCategory if not provided
    const categoryToIndirectCategory = {
      'utilities': 'utilities',
      'transport': 'transportation',
      'safety': 'safetyCompliance',
      'accommodation': 'siteOverhead', // Could be site office accommodation
    };
    
    // Determine if this is an indirect cost
    const finalIsIndirectCost = isIndirectCost !== undefined ? isIndirectCost : suggestedIsIndirectCost;
    const finalIndirectCostCategory = indirectCostCategory || categoryToIndirectCategory[category] || null;
    
    // Validate indirectCostCategory if isIndirectCost is true
    if (finalIsIndirectCost) {
      const validIndirectCategories = ['utilities', 'siteOverhead', 'transportation', 'safetyCompliance'];
      if (!finalIndirectCostCategory || !validIndirectCategories.includes(finalIndirectCostCategory)) {
        return errorResponse(
          `Invalid indirectCostCategory. Must be one of: ${validIndirectCategories.join(', ')} when isIndirectCost is true`,
          400
        );
      }
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Phase Management: Strongly recommend phaseId for phase-centric tracking
    const warnings = [];
    
    // Validate phase if provided
    if (phaseId && ObjectId.isValid(phaseId)) {
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        deletedAt: null,
      });

      if (!phase) {
        return errorResponse(`Phase not found: ${phaseId}`, 404);
      }

      // Verify phase belongs to the same project
      if (phase.projectId.toString() !== projectId) {
        return errorResponse('Phase does not belong to the selected project', 400);
      }
    } else if (!phaseId || phaseId === null || phaseId === '') {
      // Phase Management: Add warning if phaseId is not provided
      warnings.push('phaseId is strongly recommended for phase-centric construction management. Expenses without a phase may be harder to track and manage.');
    } else if (phaseId && !ObjectId.isValid(phaseId)) {
      return errorResponse('Invalid phaseId format. phaseId must be a valid ObjectId', 400);
    }

    // Get user profile
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

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
      phaseId: new ObjectId(phaseId), // Required - validated above (for timeline tracking)
      isIndirectCost: finalIsIndirectCost || false, // NEW: Mark as indirect cost
      indirectCostCategory: finalIsIndirectCost ? finalIndirectCostCategory : null, // NEW: Indirect cost category
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

    // Include warnings in response if present
    if (warnings.length > 0) {
      insertedExpense.warnings = warnings;
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'EXPENSE',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { created: insertedExpense },
    });

    // Recalculate phase spending if phaseId is provided (only for direct costs)
    // Indirect costs are NOT included in phase spending
    if (phaseId && ObjectId.isValid(phaseId) && !finalIsIndirectCost) {
      try {
        await recalculatePhaseSpending(phaseId);
      } catch (phaseError) {
        console.error('Error recalculating phase spending after expense creation:', phaseError);
        // Don't fail the request, just log the error
      }
    }
    
    // If indirect cost and auto-approved, charge to indirect costs budget
    // Note: Most expenses require approval, so indirect costs will be charged on approval

    return successResponse(insertedExpense, 'Expense created successfully', 201);
  } catch (error) {
    console.error('Create expense error:', error);
    return errorResponse('Failed to create expense', 500);
  }
}

