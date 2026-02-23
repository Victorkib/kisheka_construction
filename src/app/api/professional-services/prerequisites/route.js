/**
 * Professional Services Prerequisites API Route
 * Checks if prerequisites are met for creating professional service assignments
 * 
 * GET /api/professional-services/prerequisites
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/professional-services/prerequisites
 * Returns prerequisite status for creating assignments
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const db = await getDatabase();

    // Check if library entries exist
    const libraryCount = await db.collection('professional_services_library').countDocuments({
      isActive: true,
      deletedAt: null,
    });

    // Check if projects exist (user-accessible projects)
    // Get user profile to check accessible projects
    const { getUserProfile } = await import('@/lib/auth-helpers');
    const userProfile = await getUserProfile(user.id);
    
    let projectsCount = 0;
    if (userProfile) {
      const { normalizeUserRole } = await import('@/lib/role-helpers');
      const userRole = normalizeUserRole(userProfile.role);
      
      // Owner and PM can see all projects
      if (userRole === 'owner' || userRole === 'pm' || userRole === 'project_manager') {
        projectsCount = await db.collection('projects').countDocuments({
          deletedAt: null,
        });
      } else {
        // Other roles can only see projects they're assigned to
        projectsCount = await db.collection('projects').countDocuments({
          deletedAt: null,
          $or: [
            { 'teamMembers.userId': user.id },
            { 'teamMembers.email': userProfile.email },
          ],
        });
      }
    }

    const hasLibrary = libraryCount > 0;
    const hasProjects = projectsCount > 0;
    const canProceed = hasLibrary && hasProjects;

    const missingItems = [];
    if (!hasLibrary) missingItems.push('library');
    if (!hasProjects) missingItems.push('projects');

    return successResponse({
      hasLibrary,
      libraryCount,
      hasProjects,
      projectsCount,
      canProceed,
      missingItems,
      prerequisites: {
        library: {
          completed: hasLibrary,
          message: hasLibrary 
            ? `${libraryCount} professional${libraryCount !== 1 ? 's' : ''} available in library`
            : 'No professionals in library',
          actionUrl: '/professional-services-library/new',
          actionLabel: 'Add to Library',
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
    console.error('Error checking professional services prerequisites:', err);
    return errorResponse('Failed to check prerequisites', 500);
  }
}
