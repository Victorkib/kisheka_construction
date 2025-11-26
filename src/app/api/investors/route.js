/**
 * Investors API Route
 * GET: List all investors (OWNER, ACCOUNTANT, INVESTOR - own data only)
 * POST: Create new investor (OWNER only)
 * 
 * GET /api/investors
 * POST /api/investors
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission, hasRole, ROLES } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/investors
 * Returns investors with filtering
 * Auth: OWNER (all), ACCOUNTANT (all), INVESTOR (own data only)
 * Query params: investmentType, status, search
 */
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const investmentType = searchParams.get('investmentType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const db = await getDatabase();

    // Build query
    const query = {};

    // INVESTOR role can only see their own data
    if (userProfile.role?.toLowerCase() === ROLES.INVESTOR.toLowerCase()) {
      // Find investor by userId (preferred) or fallback to email/name matching
      query.$or = [
        { userId: userProfile._id }, // Primary: match by userId
        { email: userProfile.email }, // Fallback: match by email
        { name: { $regex: userProfile.name || userProfile.email, $options: 'i' } }, // Fallback: match by name
      ];
    }

    if (investmentType) {
      query.investmentType = investmentType;
    }

    // Archive filter: if archived=true, show only archived; if archived=false or not set, exclude archived
    const archived = searchParams.get('archived');
    if (archived === 'true') {
      query.status = 'ARCHIVED';
    } else if (archived === 'false' || !archived) {
      // Default to active investors only (exclude archived)
      if (!status) {
        query.status = 'ACTIVE';
      }
    }

    // Status filter (overrides archive filter if both are provided)
    if (status) {
      query.status = status;
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
          ],
        },
      ];
    }

    // Execute query
    const investors = await db
      .collection('investors')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Calculate totals
    const totals = await db
      .collection('investors')
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalInvested: { $sum: '$totalInvested' },
            totalLoans: {
              $sum: {
                $cond: [
                  { $in: ['$investmentType', ['LOAN', 'MIXED']] },
                  '$totalInvested',
                  0,
                ],
              },
            },
            totalEquity: {
              $sum: {
                $cond: [
                  { $in: ['$investmentType', ['EQUITY', 'MIXED']] },
                  '$totalInvested',
                  0,
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const summary = totals[0] || {
      totalInvested: 0,
      totalLoans: 0,
      totalEquity: 0,
      count: 0,
    };

    return successResponse({
      data: investors,
      summary,
      total: investors.length,
    });
  } catch (error) {
    console.error('Error fetching investors:', error);
    return errorResponse('Failed to fetch investors', 500);
  }
}

/**
 * POST /api/investors
 * Creates a new investor
 * Auth: OWNER only
 * Body: { name, email, phone, investmentType, totalInvested, loanTerms?, documents? }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_investors');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can create investors.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      investmentType,
      totalInvested,
      loanTerms,
      documents,
      initialContribution,
      userId, // Optional: link to existing user account
    } = body;

    // Validation
    if (!name || !investmentType || !totalInvested) {
      return errorResponse('Name, investment type, and total invested are required', 400);
    }

    if (!['EQUITY', 'LOAN', 'MIXED'].includes(investmentType)) {
      return errorResponse('Invalid investment type. Must be EQUITY, LOAN, or MIXED', 400);
    }

    if (parseFloat(totalInvested) <= 0) {
      return errorResponse('Total invested must be greater than 0', 400);
    }

    const db = await getDatabase();

    // Validate userId if provided
    if (userId) {
      if (!ObjectId.isValid(userId)) {
        return errorResponse('Invalid userId format', 400);
      }
      
      // Check if user exists
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return errorResponse('User not found', 404);
      }
      
      // Check if investor already exists for this user
      const existingInvestorForUser = await db.collection('investors').findOne({ userId: new ObjectId(userId) });
      if (existingInvestorForUser) {
        return errorResponse('Investor record already exists for this user', 400);
      }
      
      // Verify email matches if provided
      if (email && user.email && email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
        return errorResponse('Email does not match the linked user account', 400);
      }
    }
    
    // Check if investor with same email already exists
    if (email) {
      const existing = await db.collection('investors').findOne({ email });
      if (existing) {
        return errorResponse('Investor with this email already exists', 400);
      }
    }

    // Prepare contributions array
    const contributions = [];
    if (initialContribution) {
      contributions.push({
        amount: parseFloat(initialContribution.amount || totalInvested),
        date: initialContribution.date ? new Date(initialContribution.date) : new Date(),
        type: initialContribution.type || investmentType,
        notes: initialContribution.notes || 'Initial contribution',
        receiptUrl: initialContribution.receiptUrl || null,
      });
    } else {
      // Auto-create initial contribution if not provided
      contributions.push({
        amount: parseFloat(totalInvested),
        date: new Date(),
        type: investmentType,
        notes: 'Initial contribution',
        receiptUrl: null,
      });
    }

    // Create investor document
    const investor = {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      investmentType,
      totalInvested: parseFloat(totalInvested),
      contributions,
      loanTerms: loanTerms || null,
      documents: documents || [],
      userId: userId ? new ObjectId(userId) : null, // Link to user account if provided
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('investors').insertOne(investor);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id,
      action: 'CREATE_INVESTOR',
      resourceType: 'investor',
      resourceId: result.insertedId,
      details: {
        investorName: name,
        investmentType,
        totalInvested: parseFloat(totalInvested),
      },
    });

    return successResponse(
      {
        _id: result.insertedId,
        ...investor,
      },
      'Investor created successfully',
      201
    );
  } catch (error) {
    console.error('Error creating investor:', error);
    return errorResponse('Failed to create investor', 500);
  }
}

