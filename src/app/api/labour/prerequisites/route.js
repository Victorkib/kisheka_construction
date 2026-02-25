/**
 * Labour Prerequisites API Route
 * Checks if prerequisites are met for labour-related pages
 * 
 * GET /api/labour/prerequisites?pageType=...&projectId=...
 * Auth: All authenticated users
 * 
 * Query params:
 * - pageType: 'dashboard' | 'entries' | 'entry-new' | 'bulk-new' | 'workers' | 'site-reports'
 * - projectId: Optional project ID for project-specific checks
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { successResponse, errorResponse } from '@/lib/api-response';
import { ObjectId } from 'mongodb';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/labour/prerequisites
 * Returns prerequisite status for labour pages
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const pageType = searchParams.get('pageType') || 'dashboard';
    const projectId = searchParams.get('projectId');
    const projectObjectId = projectId && ObjectId.isValid(projectId) ? new ObjectId(projectId) : null;

    const db = await getDatabase();

    // Get user profile for role-based filtering
    const { getUserProfile } = await import('@/lib/auth-helpers');
    const userProfile = await getUserProfile(user.id);
    
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { normalizeUserRole } = await import('@/lib/role-helpers');
    const userRole = normalizeUserRole(userProfile.role);

    // Build project filter based on user role
    let projectFilter = { deletedAt: null };
    if (projectObjectId) {
      projectFilter._id = projectObjectId;
    } else if (userRole !== 'owner' && userRole !== 'pm' && userRole !== 'project_manager') {
      // Other roles can only see projects they're assigned to
      projectFilter.$or = [
        { 'teamMembers.userId': user.id },
        { 'teamMembers.email': userProfile.email },
      ];
    }

    // Check projects
    const projectsCount = await db.collection('projects').countDocuments(projectFilter);
    const hasProjects = projectsCount > 0;

    // Check phases (only if we have projects)
    let phasesCount = 0;
    let hasPhases = false;
    if (hasProjects) {
      const phaseFilter = { deletedAt: null };
      if (projectObjectId) {
        phaseFilter.projectId = projectObjectId;
      } else if (userRole !== 'owner' && userRole !== 'pm' && userRole !== 'project_manager') {
        // Get accessible project IDs for this user
        const accessibleProjects = await db.collection('projects').find({
          deletedAt: null,
          $or: [
            { 'teamMembers.userId': user.id },
            { 'teamMembers.email': userProfile.email },
          ],
        }).toArray();
        const accessibleProjectIds = accessibleProjects.map(p => p._id);
        if (accessibleProjectIds.length > 0) {
          phaseFilter.projectId = { $in: accessibleProjectIds };
        } else {
          phaseFilter.projectId = { $in: [] }; // No accessible projects = no phases
        }
      }
      phasesCount = await db.collection('phases').countDocuments(phaseFilter);
      hasPhases = phasesCount > 0;
    }

    // Check workers
    const workersCount = await db.collection('worker_profiles').countDocuments({
      status: { $in: ['active', 'on_leave'] },
      deletedAt: null,
    });
    const hasWorkers = workersCount > 0;

    // Check work items (only if we have phases)
    let workItemsCount = 0;
    let hasWorkItems = false;
    if (hasPhases) {
      const workItemFilter = { deletedAt: null };
      if (projectObjectId) {
        workItemFilter.projectId = projectObjectId;
      } else if (userRole !== 'owner' && userRole !== 'pm' && userRole !== 'project_manager') {
        const accessibleProjects = await db.collection('projects').find({
          deletedAt: null,
          $or: [
            { 'teamMembers.userId': user.id },
            { 'teamMembers.email': userProfile.email },
          ],
        }).toArray();
        const accessibleProjectIds = accessibleProjects.map(p => p._id);
        if (accessibleProjectIds.length > 0) {
          workItemFilter.projectId = { $in: accessibleProjectIds };
        } else {
          workItemFilter.projectId = { $in: [] };
        }
      }
      workItemsCount = await db.collection('work_items').countDocuments(workItemFilter);
      hasWorkItems = workItemsCount > 0;
    }

    // Check indirect cost categories (for indirect labour)
    const indirectCategoriesCount = await db.collection('categories').countDocuments({
      deletedAt: null,
      isIndirectCost: true,
    });
    const hasIndirectCategories = indirectCategoriesCount > 0;

    // Check labour budgets (phases with labour budget > 0)
    let phasesWithBudgetCount = 0;
    let hasLabourBudgets = false;
    if (hasPhases) {
      const phaseBudgetFilter = { 
        deletedAt: null,
        'budgetAllocation.labour': { $gt: 0 },
      };
      if (projectObjectId) {
        phaseBudgetFilter.projectId = projectObjectId;
      } else if (userRole !== 'owner' && userRole !== 'pm' && userRole !== 'project_manager') {
        const accessibleProjects = await db.collection('projects').find({
          deletedAt: null,
          $or: [
            { 'teamMembers.userId': user.id },
            { 'teamMembers.email': userProfile.email },
          ],
        }).toArray();
        const accessibleProjectIds = accessibleProjects.map(p => p._id);
        if (accessibleProjectIds.length > 0) {
          phaseBudgetFilter.projectId = { $in: accessibleProjectIds };
        } else {
          phaseBudgetFilter.projectId = { $in: [] };
        }
      }
      phasesWithBudgetCount = await db.collection('phases').countDocuments(phaseBudgetFilter);
      hasLabourBudgets = phasesWithBudgetCount > 0;
    }

    // Determine prerequisites based on page type
    let prerequisites = {};
    let canProceed = false;
    let requiredItems = [];
    let recommendedItems = [];

    switch (pageType) {
      case 'dashboard':
        // Dashboard needs: projects, phases (required)
        // Recommended: workers, labour budgets
        requiredItems = ['projects', 'phases'];
        recommendedItems = ['workers', 'labourBudgets'];
        canProceed = hasProjects && hasPhases;
        prerequisites = {
          projects: {
            completed: hasProjects,
            message: hasProjects
              ? `${projectsCount} project${projectsCount !== 1 ? 's' : ''} available`
              : 'No projects available',
            actionUrl: '/projects/new',
            actionLabel: 'Create Project',
          },
          phases: {
            completed: hasPhases,
            message: hasPhases
              ? `${phasesCount} phase${phasesCount !== 1 ? 's' : ''} available`
              : 'No phases available. Add phases to your projects',
            actionUrl: hasProjects ? '/phases/new' : '/projects',
            actionLabel: hasProjects ? 'Add Phase' : 'Create Project',
          },
          workers: {
            completed: hasWorkers,
            message: hasWorkers
              ? `${workersCount} worker${workersCount !== 1 ? 's' : ''} available`
              : 'No workers defined. Create worker profiles for easier labour entry',
            actionUrl: '/labour/workers/new',
            actionLabel: 'Add Worker',
            recommended: true,
          },
          labourBudgets: {
            completed: hasLabourBudgets,
            message: hasLabourBudgets
              ? `${phasesWithBudgetCount} phase${phasesWithBudgetCount !== 1 ? 's' : ''} with labour budget`
              : 'No labour budgets set. Set budgets on phases for better financial tracking',
            actionUrl: hasPhases ? '/phases' : '/projects',
            actionLabel: 'Set Budgets',
            recommended: true,
          },
        };
        break;

      case 'entries':
      case 'entry-new':
        // Entries need: projects, phases (required)
        // For direct labour: work items (required), workers (strongly recommended)
        // For indirect labour: indirect categories (required)
        // Recommended: labour budgets
        requiredItems = ['projects', 'phases'];
        recommendedItems = ['workers', 'workItems', 'labourBudgets'];
        canProceed = hasProjects && hasPhases;
        
        prerequisites = {
          projects: {
            completed: hasProjects,
            message: hasProjects
              ? `${projectsCount} project${projectsCount !== 1 ? 's' : ''} available`
              : 'No projects available',
            actionUrl: '/projects/new',
            actionLabel: 'Create Project',
          },
          phases: {
            completed: hasPhases,
            message: hasPhases
              ? `${phasesCount} phase${phasesCount !== 1 ? 's' : ''} available`
              : 'No phases available. Add phases to your projects',
            actionUrl: hasProjects ? '/phases/new' : '/projects',
            actionLabel: hasProjects ? 'Add Phase' : 'Create Project',
          },
          workers: {
            completed: hasWorkers,
            message: hasWorkers
              ? `${workersCount} worker${workersCount !== 1 ? 's' : ''} available`
              : 'No workers defined. Create worker profiles for easier labour entry',
            actionUrl: '/labour/workers/new',
            actionLabel: 'Add Worker',
            recommended: true,
          },
          workItems: {
            completed: hasWorkItems,
            message: hasWorkItems
              ? `${workItemsCount} work item${workItemsCount !== 1 ? 's' : ''} available`
              : 'No work items available. Create work items for direct labour tracking',
            actionUrl: hasPhases ? '/work-items/new' : '/phases',
            actionLabel: 'Create Work Item',
            recommended: true,
          },
          indirectCategories: {
            completed: hasIndirectCategories,
            message: hasIndirectCategories
              ? `${indirectCategoriesCount} indirect cost categor${indirectCategoriesCount !== 1 ? 'ies' : 'y'} available`
              : 'No indirect cost categories. Create categories for indirect labour tracking',
            actionUrl: '/categories/new',
            actionLabel: 'Add Category',
            recommended: true,
          },
          labourBudgets: {
            completed: hasLabourBudgets,
            message: hasLabourBudgets
              ? `${phasesWithBudgetCount} phase${phasesWithBudgetCount !== 1 ? 's' : ''} with labour budget`
              : 'No labour budgets set. Set budgets on phases for budget validation',
            actionUrl: hasPhases ? '/phases' : '/projects',
            actionLabel: 'Set Budgets',
            recommended: true,
          },
        };
        break;

      case 'bulk-new':
        // Bulk entry needs: projects, phases, workers (required)
        // Recommended: work items, indirect categories, labour budgets
        requiredItems = ['projects', 'phases', 'workers'];
        recommendedItems = ['workItems', 'indirectCategories', 'labourBudgets'];
        canProceed = hasProjects && hasPhases && hasWorkers;
        
        prerequisites = {
          projects: {
            completed: hasProjects,
            message: hasProjects
              ? `${projectsCount} project${projectsCount !== 1 ? 's' : ''} available`
              : 'No projects available',
            actionUrl: '/projects/new',
            actionLabel: 'Create Project',
          },
          phases: {
            completed: hasPhases,
            message: hasPhases
              ? `${phasesCount} phase${phasesCount !== 1 ? 's' : ''} available`
              : 'No phases available. Add phases to your projects',
            actionUrl: hasProjects ? '/phases/new' : '/projects',
            actionLabel: hasProjects ? 'Add Phase' : 'Create Project',
          },
          workers: {
            completed: hasWorkers,
            message: hasWorkers
              ? `${workersCount} worker${workersCount !== 1 ? 's' : ''} available`
              : 'No workers defined. Create at least one worker profile',
            actionUrl: '/labour/workers/new',
            actionLabel: 'Add Worker',
          },
          workItems: {
            completed: hasWorkItems,
            message: hasWorkItems
              ? `${workItemsCount} work item${workItemsCount !== 1 ? 's' : ''} available`
              : 'No work items available. Create work items for direct labour tracking',
            actionUrl: hasPhases ? '/work-items/new' : '/phases',
            actionLabel: 'Create Work Item',
            recommended: true,
          },
          indirectCategories: {
            completed: hasIndirectCategories,
            message: hasIndirectCategories
              ? `${indirectCategoriesCount} indirect cost categor${indirectCategoriesCount !== 1 ? 'ies' : 'y'} available`
              : 'No indirect cost categories. Create categories for indirect labour tracking',
            actionUrl: '/categories/new',
            actionLabel: 'Add Category',
            recommended: true,
          },
          labourBudgets: {
            completed: hasLabourBudgets,
            message: hasLabourBudgets
              ? `${phasesWithBudgetCount} phase${phasesWithBudgetCount !== 1 ? 's' : ''} with labour budget`
              : 'No labour budgets set. Set budgets on phases for budget validation',
            actionUrl: hasPhases ? '/phases' : '/projects',
            actionLabel: 'Set Budgets',
            recommended: true,
          },
        };
        break;

      case 'workers':
        // Workers page is informational, but projects are nice to have
        requiredItems = [];
        recommendedItems = ['projects'];
        canProceed = true; // Always can proceed
        
        prerequisites = {
          projects: {
            completed: hasProjects,
            message: hasProjects
              ? `${projectsCount} project${projectsCount !== 1 ? 's' : ''} available`
              : 'No projects available. Create projects to assign workers',
            actionUrl: '/projects/new',
            actionLabel: 'Create Project',
            recommended: true,
          },
        };
        break;

      case 'site-reports':
        // Site reports need: projects, phases, workers (required)
        requiredItems = ['projects', 'phases', 'workers'];
        recommendedItems = ['workItems'];
        canProceed = hasProjects && hasPhases && hasWorkers;
        
        prerequisites = {
          projects: {
            completed: hasProjects,
            message: hasProjects
              ? `${projectsCount} project${projectsCount !== 1 ? 's' : ''} available`
              : 'No projects available',
            actionUrl: '/projects/new',
            actionLabel: 'Create Project',
          },
          phases: {
            completed: hasPhases,
            message: hasPhases
              ? `${phasesCount} phase${phasesCount !== 1 ? 's' : ''} available`
              : 'No phases available. Add phases to your projects',
            actionUrl: hasProjects ? '/phases/new' : '/projects',
            actionLabel: hasProjects ? 'Add Phase' : 'Create Project',
          },
          workers: {
            completed: hasWorkers,
            message: hasWorkers
              ? `${workersCount} worker${workersCount !== 1 ? 's' : ''} available`
              : 'No workers defined. Create worker profiles',
            actionUrl: '/labour/workers/new',
            actionLabel: 'Add Worker',
          },
          workItems: {
            completed: hasWorkItems,
            message: hasWorkItems
              ? `${workItemsCount} work item${workItemsCount !== 1 ? 's' : ''} available`
              : 'No work items available. Create work items for better tracking',
            actionUrl: hasPhases ? '/work-items/new' : '/phases',
            actionLabel: 'Create Work Item',
            recommended: true,
          },
        };
        break;

      default:
        // Default to dashboard requirements
        requiredItems = ['projects', 'phases'];
        recommendedItems = ['workers'];
        canProceed = hasProjects && hasPhases;
        prerequisites = {
          projects: {
            completed: hasProjects,
            message: hasProjects
              ? `${projectsCount} project${projectsCount !== 1 ? 's' : ''} available`
              : 'No projects available',
            actionUrl: '/projects/new',
            actionLabel: 'Create Project',
          },
          phases: {
            completed: hasPhases,
            message: hasPhases
              ? `${phasesCount} phase${phasesCount !== 1 ? 's' : ''} available`
              : 'No phases available',
            actionUrl: hasProjects ? '/phases/new' : '/projects',
            actionLabel: hasProjects ? 'Add Phase' : 'Create Project',
          },
        };
    }

    return successResponse({
      pageType,
      hasProjects,
      projectsCount,
      hasPhases,
      phasesCount,
      hasWorkers,
      workersCount,
      hasWorkItems,
      workItemsCount,
      hasIndirectCategories,
      indirectCategoriesCount,
      hasLabourBudgets,
      phasesWithBudgetCount,
      canProceed,
      requiredItems,
      recommendedItems,
      prerequisites,
    });
  } catch (err) {
    console.error('Error checking labour prerequisites:', err);
    return errorResponse('Failed to check prerequisites', 500);
  }
}
