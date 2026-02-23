/**
 * Professional Fees Prerequisites API Route
 * Checks if prerequisites are met for creating professional fees
 * 
 * GET /api/professional-fees/prerequisites
 * Query params: projectId (optional)
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/professional-fees/prerequisites
 * Returns prerequisite status for creating fees
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

    const db = await getDatabase();

    // Build query for active assignments
    const assignmentQuery = {
      status: 'active',
      deletedAt: null,
    };

    if (projectId && ObjectId.isValid(projectId)) {
      assignmentQuery.projectId = new ObjectId(projectId);
    }

    // Check if active assignments exist
    const assignmentsCount = await db.collection('professional_services').countDocuments(assignmentQuery);

    // Check if projects exist (user-accessible projects)
    const { getUserProfile } = await import('@/lib/auth-helpers');
    const userProfile = await getUserProfile(user.id);
    
    let projectsCount = 0;
    if (userProfile) {
      const { normalizeUserRole } = await import('@/lib/role-helpers');
      const userRole = normalizeUserRole(userProfile.role);
      
      if (userRole === 'owner' || userRole === 'pm' || userRole === 'project_manager') {
        projectsCount = await db.collection('projects').countDocuments({
          deletedAt: null,
        });
      } else {
        projectsCount = await db.collection('projects').countDocuments({
          deletedAt: null,
          $or: [
            { 'teamMembers.userId': user.id },
            { 'teamMembers.email': userProfile.email },
          ],
        });
      }
    }

    const hasAssignments = assignmentsCount > 0;
    const hasProjects = projectsCount > 0;
    const canProceed = hasAssignments && hasProjects;

    const missingItems = [];
    if (!hasAssignments) missingItems.push('assignments');
    if (!hasProjects) missingItems.push('projects');

    return successResponse({
      hasAssignments,
      assignmentsCount,
      hasProjects,
      projectsCount,
      canProceed,
      missingItems,
      projectId: projectId || null,
      prerequisites: {
        assignments: {
          completed: hasAssignments,
          message: hasAssignments
            ? `${assignmentsCount} active assignment${assignmentsCount !== 1 ? 's' : ''} available`
            : projectId
              ? 'No active assignments for this project'
              : 'No active assignments available',
          actionUrl: '/professional-services',
          actionLabel: 'View Assignments',
        },
        projects: {
          completed: hasProjects,
          message: hasProjects
            ? `${projectsCount} project${projectsCount !== 1 ? 's' : ''} available`
            : 'No projects available',
          actionUrl: '/projects/new',
          actionLabel: 'Create Project',
        },
      },
    });
  } catch (err) {
    console.error('Error checking professional fees prerequisites:', err);
    return errorResponse('Failed to check prerequisites', 500);
  }
}
