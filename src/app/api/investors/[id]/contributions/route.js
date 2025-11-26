/**
 * Investor Contributions API Route
 * GET: List all contributions for an investor
 * POST: Add a new contribution to an investor
 * 
 * GET /api/investors/[id]/contributions
 * POST /api/investors/[id]/contributions
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission, ROLES } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/investors/[id]/contributions
 * Returns all contributions for an investor
 * Auth: OWNER, ACCOUNTANT (all), INVESTOR (own data only)
 */
export async function GET(request, { params }) {
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

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const db = await getDatabase();
    const investor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    if (!investor) {
      return errorResponse('Investor not found', 404);
    }

    // INVESTOR role can only see their own data
    if (userProfile.role?.toLowerCase() === ROLES.INVESTOR.toLowerCase()) {
      // Check by userId first (preferred), then fallback to email/name matching
      const isOwnData =
        (investor.userId && investor.userId.toString() === userProfile._id.toString()) ||
        investor.email === userProfile.email ||
        investor.name?.toLowerCase().includes(userProfile.name?.toLowerCase() || '');
      if (!isOwnData) {
        return errorResponse('Access denied. You can only view your own contributions.', 403);
      }
    }

    // Return contributions sorted by date (newest first)
    const contributions = (investor.contributions || []).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // Calculate totals
    const totals = contributions.reduce(
      (acc, contrib) => {
        acc.total += contrib.amount || 0;
        if (contrib.type === 'EQUITY' || contrib.type === 'MIXED') {
          acc.equity += contrib.amount || 0;
        }
        if (contrib.type === 'LOAN' || contrib.type === 'MIXED') {
          acc.loan += contrib.amount || 0;
        }
        return acc;
      },
      { total: 0, equity: 0, loan: 0 }
    );

    return successResponse({
      contributions,
      totals,
      investorName: investor.name,
    });
  } catch (error) {
    console.error('Get contributions error:', error);
    return errorResponse('Failed to retrieve contributions', 500);
  }
}

/**
 * POST /api/investors/[id]/contributions
 * Adds a new contribution to an investor
 * Auth: OWNER only
 * Body: { amount, date, type, notes?, receiptUrl? }
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canAdd = await hasPermission(user.id, 'add_investor_contribution');
    if (!canAdd) {
      return errorResponse('Permission denied. Only OWNER can add contributions.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const body = await request.json();
    const { amount, date, type, notes, receiptUrl } = body;

    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      return errorResponse('Valid amount is required', 400);
    }

    if (!type || !['EQUITY', 'LOAN', 'MIXED'].includes(type)) {
      return errorResponse('Valid contribution type (EQUITY, LOAN, or MIXED) is required', 400);
    }

    const db = await getDatabase();

    // Check if investor exists
    const investor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    if (!investor) {
      return errorResponse('Investor not found', 404);
    }

    // Create new contribution
    const newContribution = {
      amount: parseFloat(amount),
      date: date ? new Date(date) : new Date(),
      type,
      notes: notes || null,
      receiptUrl: receiptUrl || null,
    };

    // Update investor with new contribution
    const contributions = [...(investor.contributions || []), newContribution];
    const totalInvested = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);

    const result = await db
      .collection('investors')
      .updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            contributions,
            totalInvested,
            updatedAt: new Date(),
          },
        }
      );

    if (result.matchedCount === 0) {
      return errorResponse('Investor not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id,
      action: 'ADD_INVESTOR_CONTRIBUTION',
      resourceType: 'investor',
      resourceId: new ObjectId(id),
      details: {
        investorName: investor.name,
        contributionAmount: parseFloat(amount),
        contributionType: type,
      },
    });

    // Fetch updated investor
    const updatedInvestor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    return successResponse(
      {
        contribution: newContribution,
        investor: updatedInvestor,
      },
      'Contribution added successfully',
      201
    );
  } catch (error) {
    console.error('Add contribution error:', error);
    return errorResponse('Failed to add contribution', 500);
  }
}

