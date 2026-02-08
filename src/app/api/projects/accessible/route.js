/**
 * Accessible Projects API Route
 * GET: Returns all projects the current user has access to
 * 
 * GET /api/projects/accessible
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/projects/accessible
 * Returns projects user has access to based on memberships
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

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();
    const userId = userProfile._id;

    // Get user's project memberships
    const memberships = await db
      .collection('project_memberships')
      .find({
        userId: userId,
        status: 'active',
      })
      .toArray();

    // Get project IDs from memberships
    const projectIds = memberships.map((m) => m.projectId);

    // If user is OWNER or has global admin role, return all projects
    // Memberships are for project-specific roles, not access control for owners
    const userRole = userProfile.role?.toLowerCase();
    const isGlobalAdmin = ['owner', 'admin'].includes(userRole);

    let projects = [];

    if (isGlobalAdmin) {
      // Global admins (OWNER/ADMIN) always see ALL projects
      // This ensures owners see pre-migration projects and all projects they created
      // Memberships are for project-specific roles, not access control
      projects = await db
        .collection('projects')
        .find({
          deletedAt: null,
        })
        .sort({ createdAt: -1 })
        .toArray();
    } else if (projectIds.length > 0) {
      // Non-owners: Get projects user has access to via memberships
      projects = await db
        .collection('projects')
        .find({
          _id: { $in: projectIds },
          deletedAt: null,
        })
        .sort({ createdAt: -1 })
        .toArray();
    } else {
      // Check if user is an investor with project allocations
      if (userRole === 'investor') {
        const investor = await db.collection('investors').findOne({
          userId: userId,
          status: 'ACTIVE',
        });

        if (investor && investor.projectAllocations) {
          const investorProjectIds = investor.projectAllocations
            .map((alloc) => {
              if (alloc.projectId && ObjectId.isValid(alloc.projectId)) {
                return new ObjectId(alloc.projectId);
              }
              return null;
            })
            .filter(Boolean);

          if (investorProjectIds.length > 0) {
            projects = await db
              .collection('projects')
              .find({
                _id: { $in: investorProjectIds },
                deletedAt: null,
              })
              .sort({ createdAt: -1 })
              .toArray();
          }
        }
      }
    }

    // Enrich projects with membership info
    const projectsWithMembership = projects.map((project) => {
      const membership = memberships.find(
        (m) => m.projectId.toString() === project._id.toString()
      );

      return {
        ...project,
        membership: membership
          ? {
              role: membership.role,
              permissions: membership.permissions,
              joinedAt: membership.joinedAt,
            }
          : null,
      };
    });

    return successResponse(projectsWithMembership);
  } catch (error) {
    console.error('Get accessible projects error:', error);
    return errorResponse('Failed to retrieve accessible projects', 500);
  }
}

