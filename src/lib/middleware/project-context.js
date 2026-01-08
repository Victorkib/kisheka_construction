/**
 * Project Context Middleware Helpers
 * 
 * Provides utilities for injecting and validating project context in API routes
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';

/**
 * Get project ID from request (query params, body, or headers)
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route params (for dynamic routes)
 * @returns {string|null} Project ID or null
 */
export async function getProjectIdFromRequest(request, params = {}) {
  // Try to get from URL params (e.g., /api/projects/[id]/...)
  if (params.id && ObjectId.isValid(params.id)) {
    return params.id;
  }

  // Try to get from query params
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (projectId && ObjectId.isValid(projectId)) {
    return projectId;
  }

  // Try to get from request body (for POST/PATCH requests)
  try {
    const body = await request.clone().json().catch(() => ({}));
    if (body.projectId && ObjectId.isValid(body.projectId)) {
      return body.projectId;
    }
  } catch (error) {
    // Body might not be JSON or might be empty
  }

  // Try to get from headers (for client-side context injection)
  const projectIdHeader = request.headers.get('x-project-id');
  if (projectIdHeader && ObjectId.isValid(projectIdHeader)) {
    return projectIdHeader;
  }

  return null;
}

/**
 * Validate that user has access to a project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @returns {Promise<{hasAccess: boolean, membership: Object|null, error: string|null}>}
 */
export async function validateProjectAccess(userId, projectId) {
  try {
    if (!ObjectId.isValid(projectId)) {
      return {
        hasAccess: false,
        membership: null,
        error: 'Invalid project ID',
      };
    }

    const db = await getDatabase();
    const userObjectId = new ObjectId(userId);
    const projectObjectId = new ObjectId(projectId);

    // Get user profile to check global role
    const userProfile = await db.collection('users').findOne({
      _id: userObjectId,
    });

    if (!userProfile) {
      return {
        hasAccess: false,
        membership: null,
        error: 'User not found',
      };
    }

    const userRole = userProfile.role?.toLowerCase();

    // Global admins (OWNER) have access to all projects
    if (['owner', 'admin'].includes(userRole)) {
      // Verify project exists
      const project = await db.collection('projects').findOne({
        _id: projectObjectId,
        deletedAt: null,
      });

      if (!project) {
        return {
          hasAccess: false,
          membership: null,
          error: 'Project not found',
        };
      }

      return {
        hasAccess: true,
        membership: {
          role: 'owner',
          permissions: [],
        },
        error: null,
      };
    }

    // Check project membership
    const membership = await db.collection('project_memberships').findOne({
      userId: userObjectId,
      projectId: projectObjectId,
      status: 'active',
    });

    if (membership) {
      return {
        hasAccess: true,
        membership: {
          role: membership.role,
          permissions: membership.permissions || [],
          joinedAt: membership.joinedAt,
        },
        error: null,
      };
    }

    // Check if user is an investor with project allocation
    if (userRole === 'investor') {
      const investor = await db.collection('investors').findOne({
        userId: userObjectId,
        status: 'ACTIVE',
      });

      if (investor && investor.projectAllocations) {
        const hasAllocation = investor.projectAllocations.some((alloc) => {
          if (!alloc.projectId) return false;
          const allocProjectId = alloc.projectId instanceof ObjectId
            ? alloc.projectId
            : new ObjectId(alloc.projectId);
          return allocProjectId.equals(projectObjectId);
        });

        if (hasAllocation) {
          return {
            hasAccess: true,
            membership: {
              role: 'investor',
              permissions: ['view_reports', 'view_finances'],
            },
            error: null,
          };
        }
      }
    }

    return {
      hasAccess: false,
      membership: null,
      error: 'Access denied. You do not have access to this project.',
    };
  } catch (error) {
    console.error('Error validating project access:', error);
    return {
      hasAccess: false,
      membership: null,
      error: 'Error validating project access',
    };
  }
}

/**
 * Get project context from request with validation
 * @param {Request} request - Next.js request object
 * @param {string} supabaseUserId - Supabase user ID
 * @param {Object} params - Route params
 * @returns {Promise<{projectId: string|null, hasAccess: boolean, membership: Object|null, error: string|null}>}
 */
export async function getProjectContext(request, supabaseUserId, params = {}) {
  try {
    // Get user profile
    const userProfile = await getUserProfile(supabaseUserId);
    if (!userProfile) {
      return {
        projectId: null,
        hasAccess: false,
        membership: null,
        error: 'User profile not found',
      };
    }

    // Get project ID from request
    const projectId = await getProjectIdFromRequest(request, params);

    if (!projectId) {
      return {
        projectId: null,
        hasAccess: false,
        membership: null,
        error: null, // No project ID is not an error (optional context)
      };
    }

    // Validate access
    const accessResult = await validateProjectAccess(userProfile._id, projectId);

    return {
      projectId: projectId,
      hasAccess: accessResult.hasAccess,
      membership: accessResult.membership,
      error: accessResult.error,
    };
  } catch (error) {
    console.error('Error getting project context:', error);
    return {
      projectId: null,
      hasAccess: false,
      membership: null,
      error: 'Error getting project context',
    };
  }
}

/**
 * Create MongoDB query filter with project context
 * @param {string|null} projectId - Project ID (optional)
 * @param {Object} additionalFilters - Additional filters to merge
 * @returns {Object} MongoDB query filter
 */
export function createProjectFilter(projectId, additionalFilters = {}) {
  const filter = { ...additionalFilters };

  if (projectId && ObjectId.isValid(projectId)) {
    filter.projectId = new ObjectId(projectId);
  }

  return filter;
}

/**
 * Require project context (throws error if no project or no access)
 * @param {Request} request - Next.js request object
 * @param {string} supabaseUserId - Supabase user ID
 * @param {Object} params - Route params
 * @returns {Promise<{projectId: string, membership: Object}>}
 * @throws {Error} If project context is required but missing or access denied
 */
export async function requireProjectContext(request, supabaseUserId, params = {}) {
  const context = await getProjectContext(request, supabaseUserId, params);

  if (!context.projectId) {
    throw new Error('Project ID is required');
  }

  if (!context.hasAccess) {
    throw new Error(context.error || 'Access denied to this project');
  }

  return {
    projectId: context.projectId,
    membership: context.membership,
  };
}







