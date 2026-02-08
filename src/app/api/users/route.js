/**
 * Users API Route
 * GET: List all users (OWNER only)
 * POST: Create new user (OWNER only - for future use)
 * 
 * GET /api/users
 * POST /api/users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { normalizeRole } from '@/lib/role-normalizer';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

import { VALID_ROLES } from '@/lib/role-constants';

/**
 * GET /api/users
 * Returns all users with filtering and pagination
 * Auth: OWNER only
 * Query params: role, status, search, page, limit
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

    // Check permission - only OWNER can view users
    const canView = await hasPermission(user.id, 'view_users');
    if (!canView) {
      return errorResponse('Permission denied. Only OWNER can view users.', 403);
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const db = await getDatabase();

    // Build query
    const query = {};
    const andConditions = [];

    if (role) {
      // Normalize role and handle both 'pm' and 'project_manager' for backward compatibility
      const normalizedRole = normalizeRole(role);
      if (normalizedRole === 'pm') {
        andConditions.push({
          $or: [
            { role: 'pm' },
            { role: 'PM' },
            { role: 'project_manager' },
          ],
        });
      } else {
        query.role = normalizedRole;
      }
    }

    if (status) {
      query.status = status;
    } else {
      // Default to active users only (including users without status field)
      andConditions.push({
        $or: [
          { status: 'active' },
          { status: { $exists: false } },
          { status: null },
        ],
      });
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      andConditions.push({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { $expr: { $regexMatch: { input: { $concat: ['$firstName', ' ', '$lastName'] }, regex: search, options: 'i' } } },
        ],
      });
    }

    // Combine all conditions
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Get total count for pagination
    const totalCount = await db.collection('users').countDocuments(query);

    // Execute query with pagination
    const users = await db
      .collection('users')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Remove sensitive data and format response
    const formattedUsers = users.map((user) => {
      const { password, ...safeUser } = user;
      return {
        ...safeUser,
        id: safeUser._id?.toString(),
        _id: undefined,
      };
    });

    // Get role distribution
    const roleDistribution = await db
      .collection('users')
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    return successResponse({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        role,
        status,
        search,
      },
      roleDistribution: roleDistribution.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return errorResponse('Failed to fetch users', 500);
  }
}

/**
 * POST /api/users
 * Creates a new user (for future use - currently registration handles this)
 * Auth: OWNER only
 * Body: { email, password, firstName, lastName, role }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can create users
    const canManage = await hasPermission(user.id, 'manage_users');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can create users.', 403);
    }

    const body = await request.json();
    const { email, password, firstName, lastName, role } = body;

    // Validation
    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400);
    }

    if (role && !VALID_ROLES.includes(role.toLowerCase())) {
      return errorResponse(`Invalid role. Valid roles are: ${VALID_ROLES.join(', ')}`, 400);
    }

    // Check if user already exists
    const db = await getDatabase();
    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return errorResponse('User with this email already exists', 409);
    }

    // Create user in Supabase
    const { data: supabaseData, error: signupError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (signupError || !supabaseData.user) {
      return errorResponse(signupError?.message || 'Failed to create user', 400);
    }

    // Create user in MongoDB
    const newUser = {
      supabaseId: supabaseData.user.id,
      email: email.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      role: role?.toLowerCase() || 'site_clerk',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      isVerified: supabaseData.user.email_confirmed_at ? true : false,
      notificationPreferences: {
        emailNotifications: true,
        approvalAlerts: true,
        budgetAlerts: true,
        dailyReports: false,
      },
      metadata: {
        loginCount: 0,
        lastActivityAt: null,
        failedLoginAttempts: 0,
      },
    };

    const result = await db.collection('users').insertOne(newUser);

    // Log role change if role was specified
    if (role && role.toLowerCase() !== 'site_clerk') {
      await db.collection('role_changes').insertOne({
        userId: result.insertedId,
        oldRole: null,
        newRole: role.toLowerCase(),
        changedBy: user.id,
        reason: 'User created by owner',
        timestamp: new Date(),
      });
    }

    const { password: _, ...safeUser } = newUser;

    return successResponse(
      {
        ...safeUser,
        id: result.insertedId.toString(),
        _id: undefined,
      },
      'User created successfully',
      201
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return errorResponse('Failed to create user', 500);
  }
}

