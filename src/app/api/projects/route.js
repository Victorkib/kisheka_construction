/**
 * Projects API Route
 * GET: List all projects
 * POST: Create new project
 * 
 * GET /api/projects
 * POST /api/projects
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { normalizeRole } from '@/lib/role-normalizer';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import { recalculateProjectFinances } from '@/lib/financial-helpers';
import { 
  isEnhancedBudget, 
  createEnhancedBudget, 
  convertLegacyToEnhanced,
  validateBudget 
} from '@/lib/schemas/budget-schema';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects
 * Returns all projects with optional filters
 * Auth: All authenticated users
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
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const archived = searchParams.get('archived');

    const db = await getDatabase();
    const userId = userProfile._id;

    // Get user's accessible projects (same logic as /api/projects/accessible)
    const memberships = await db
      .collection('project_memberships')
      .find({
        userId: userId,
        status: 'active',
      })
      .toArray();

    const projectIds = memberships.map((m) => m.projectId);
    const userRole = userProfile.role?.toLowerCase();
    const isGlobalAdmin = ['owner', 'admin'].includes(userRole);

    let accessibleProjectIds = [];

    if (isGlobalAdmin) {
      // Global admins see all projects - get all project IDs
      const allProjects = await db
        .collection('projects')
        .find({ deletedAt: null })
        .project({ _id: 1 })
        .toArray();
      accessibleProjectIds = allProjects.map((p) => p._id);
    } else if (projectIds.length > 0) {
      accessibleProjectIds = projectIds;
    } else if (userRole === 'investor') {
      // Check investor allocations
      const investor = await db.collection('investors').findOne({
        userId: userId,
        status: 'ACTIVE',
      });

      if (investor && investor.projectAllocations) {
        accessibleProjectIds = investor.projectAllocations
          .map((alloc) => {
            if (alloc.projectId && ObjectId.isValid(alloc.projectId)) {
              return new ObjectId(alloc.projectId);
            }
            return null;
          })
          .filter(Boolean);
      }
    }

    // Build query - only include accessible projects
    const query = {
      deletedAt: null,
    };

    // Filter by accessible projects (unless user is admin/owner who sees all)
    if (!isGlobalAdmin && accessibleProjectIds.length > 0) {
      query._id = { $in: accessibleProjectIds };
    } else if (!isGlobalAdmin && accessibleProjectIds.length === 0) {
      // User has no accessible projects, return empty array
      return successResponse([], 'No accessible projects');
    }

    // Archive filter: if archived=true, show only archived; if archived=false or not set, exclude archived
    // Only apply archive filter if explicitly requested, otherwise show all non-archived projects
    if (archived === 'true') {
      query.status = 'archived';
    } else if (archived === 'false') {
      query.status = { $ne: 'archived' };
    } else {
      // Default: exclude archived projects unless explicitly requested
      query.status = { $ne: 'archived' };
    }

    // Status filter (overrides archive filter if both are provided)
    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { projectName: { $regex: search, $options: 'i' } },
        { projectCode: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const projects = await db
      .collection('projects')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Add financing statistics to each project
    const projectsWithFinancing = await Promise.all(
      projects.map(async (project) => {
        try {
          const projectTotals = await calculateProjectTotals(project._id.toString());
          const totalInvested = projectTotals.totalInvested || 0;
          
          // Get project finances for capital balance
          const projectFinances = await db
            .collection('project_finances')
            .findOne({ projectId: project._id });
          
          const capitalBalance = projectFinances?.capitalBalance || totalInvested;
          
          // Get professional services statistics
          let professionalServicesStats = null;
          try {
            const { calculateProjectProfessionalServicesStats } = await import('@/lib/professional-services-helpers');
            professionalServicesStats = await calculateProjectProfessionalServicesStats(project._id.toString());
          } catch (err) {
            console.error(`Error calculating professional services stats for project ${project._id}:`, err);
          }
          
          return {
            ...project,
            statistics: {
              totalInvested,
              capitalBalance,
              budgetVsCapitalWarning: project.budget?.total > totalInvested && totalInvested > 0
                ? `Budget (${project.budget.total.toLocaleString()}) exceeds capital (${totalInvested.toLocaleString()})`
                : null,
              professionalServices: professionalServicesStats,
            },
          };
        } catch (err) {
          console.error(`Error calculating financing for project ${project._id}:`, err);
          return {
            ...project,
            statistics: {
              totalInvested: 0,
              capitalBalance: 0,
              budgetVsCapitalWarning: null,
              professionalServices: null,
            },
          };
        }
      })
    );

    return successResponse(projectsWithFinancing, 'Projects retrieved successfully');
  } catch (error) {
    console.error('Get projects error:', error);
    return errorResponse('Failed to retrieve projects', 500);
  }
}

/**
 * POST /api/projects
 * Creates a new project
 * Auth: OWNER, PM only
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - OWNER and PM can create projects
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const canCreate = ['owner', 'pm', 'project_manager'].includes(userRole);
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can create projects.', 403);
    }

    const body = await request.json();
    const {
      projectCode,
      projectName,
      description,
      location,
      client,
      status = 'planning',
      startDate,
      plannedEndDate,
      budget,
      floorCount,
      autoCreateFloors = true, // Default: true for backward compatibility
      includeBasements = false,
      basementCount = 0,
      autoInitializePhases = true, // Default: true for better UX
      siteManager, // Site manager user ID
      teamMembers, // Array of team member user IDs
    } = body;

    // Validation
    if (!projectCode || projectCode.trim().length === 0) {
      return errorResponse('Project code is required', 400);
    }

    if (!projectName || projectName.trim().length === 0) {
      return errorResponse('Project name is required', 400);
    }

    const db = await getDatabase();

    // Check if project code already exists
    const existing = await db.collection('projects').findOne({
      projectCode: projectCode.trim(),
    });

    if (existing) {
      return errorResponse('Project with this code already exists', 400);
    }

    // Check budget and generate warning if zero (don't block project creation)
    // Optional: Require budget > 0 (configurable via environment variable)
    let budgetWarning = null;
    let finalBudget;
    
    // All budgets must be in enhanced structure
    // If legacy structure is provided, convert it immediately
    if (budget) {
      // Check if it's already enhanced
      if (isEnhancedBudget(budget)) {
        // Validate enhanced budget
        const validation = validateBudget(budget);
        if (!validation.isValid) {
          return errorResponse(`Invalid budget: ${validation.errors.join(', ')}`, 400);
        }
        
        // Log warnings if any (but don't block project creation)
        if (validation.warnings && validation.warnings.length > 0) {
          console.warn('Budget validation warnings:', validation.warnings);
        }
        
        // Use provided enhanced budget
        finalBudget = createEnhancedBudget(budget);
      } else if (budget.materials !== undefined || budget.labour !== undefined || budget.contingency !== undefined) {
        // Legacy structure detected - convert to enhanced
        // This should not happen in normal flow, but handle gracefully
        console.warn('Legacy budget structure detected during project creation. Converting to enhanced structure.');
        finalBudget = convertLegacyToEnhanced({
          total: budget.total || 0,
          materials: budget.materials || 0,
          labour: budget.labour || 0,
          contingency: budget.contingency || 0,
          spent: 0
        });
      } else {
        // Budget object provided but not in expected format - treat as empty
        finalBudget = createEnhancedBudget({
          total: budget.total || 0,
          directConstructionCosts: 0,
          preConstructionCosts: 0,
          indirectCosts: 0,
          contingencyReserve: 0
        });
      }
      
      // Check budget total for warnings
      const budgetTotal = finalBudget.total || 0;
      if (process.env.REQUIRE_PROJECT_BUDGET === 'true') {
        if (!budgetTotal || budgetTotal <= 0) {
          return errorResponse('Project budget is required and must be greater than 0', 400);
        }
      } else if (budgetTotal === 0) {
        budgetWarning = {
          message: 'Project created with zero budget. Please set budget before creating materials.',
          type: 'zero_budget',
        };
      }
    } else {
      // No budget provided - create empty enhanced structure
      if (process.env.REQUIRE_PROJECT_BUDGET === 'true') {
        return errorResponse('Project budget is required', 400);
      }
      
      budgetWarning = {
        message: 'Project created with zero budget. Please set budget before creating materials.',
        type: 'zero_budget',
      };
      
      finalBudget = createEnhancedBudget({
        total: 0,
        directConstructionCosts: 0,
        preConstructionCosts: 0,
        indirectCosts: 0,
        contingencyReserve: 0
      });
    }

    // Validate site manager if provided
    let siteManagerId = null;
    if (siteManager && ObjectId.isValid(siteManager)) {
      const siteManagerUser = await db.collection('users').findOne({
        _id: new ObjectId(siteManager),
        status: { $in: ['active', null] }, // Allow active or no status
      });
      
      if (!siteManagerUser) {
        return errorResponse('Site manager not found or inactive', 400);
      }
      
      // Verify user has appropriate role (PM, Supervisor, or Owner)
      const userRole = siteManagerUser.role?.toLowerCase();
      const validSiteManagerRoles = ['pm', 'project_manager', 'supervisor', 'owner'];
      if (!validSiteManagerRoles.includes(userRole)) {
        return errorResponse(
          `User "${siteManagerUser.firstName || ''} ${siteManagerUser.lastName || ''}" does not have a role suitable for site manager. ` +
          `Required roles: Project Manager, Supervisor, or Owner.`,
          400
        );
      }
      
      siteManagerId = new ObjectId(siteManager);
    }

    // Validate team members if provided
    const validatedTeamMembers = [];
    if (Array.isArray(teamMembers) && teamMembers.length > 0) {
      for (const memberId of teamMembers) {
        if (ObjectId.isValid(memberId)) {
          const member = await db.collection('users').findOne({
            _id: new ObjectId(memberId),
            status: { $in: ['active', null] },
          });
          if (member) {
            validatedTeamMembers.push(new ObjectId(memberId));
          }
        }
      }
    }

    // Create project
    const project = {
      projectCode: projectCode.trim(),
      projectName: projectName.trim(),
      description: description?.trim() || '',
      location: location?.trim() || '',
      client: client?.trim() || '',
      status: status || 'planning',
      startDate: startDate ? new Date(startDate) : null,
      plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
      actualEndDate: null,
      budget: finalBudget,
      siteManager: siteManagerId,
      teamMembers: validatedTeamMembers,
      createdBy: new ObjectId(userProfile._id),
      createdAt: new Date(),
      updatedAt: new Date(),
      documents: [],
      metadata: {
        contractValue: finalBudget.total || 0,
        estimatedDuration: null,
        completionPercentage: 0,
      },
    };

    const result = await db.collection('projects').insertOne(project);

    const insertedProject = { ...project, _id: result.insertedId };

    // Ensure creator has project membership for access (non-owners rely on this)
    try {
      const creatorRole = normalizeRole(userProfile.role) || 'pm';
      await db.collection('project_memberships').insertOne({
        userId: new ObjectId(userProfile._id),
        projectId: result.insertedId,
        role: creatorRole,
        permissions: [],
        joinedAt: new Date(),
        removedAt: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (membershipError) {
      console.error('Error creating project membership for creator:', membershipError);
    }

    // Auto-create floors (configurable)
    const defaultFloors = [];
    let floorsCreatedCount = 0;
    let floorCreationWarning = null;
    if (autoCreateFloors !== false) { // Default: true for backward compatibility
      const requestedFloorCount = floorCount !== undefined ? parseInt(floorCount) : 10; // Default: 10
      const maxFloors = Math.min(Math.max(0, requestedFloorCount), 50); // Cap at 50 floors, minimum 0
      const requestedBasementCount = includeBasements ? Math.min(Math.max(0, parseInt(basementCount) || 0), 10) : 0; // Cap at 10 basements
      
      // Create basements first (if any) - negative floor numbers
      if (requestedBasementCount > 0) {
        for (let i = requestedBasementCount; i >= 1; i--) {
          defaultFloors.push({
            projectId: result.insertedId,
            floorNumber: -i, // Negative numbers for basements
            name: `Basement ${i}`,
            description: `Basement ${i} of ${project.projectName || 'the building'}`,
            status: 'NOT_STARTED',
            startDate: null,
            completionDate: null,
            totalBudget: 0,
            actualCost: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
      
      // Create ground floor (0) if any floors are requested
      if (maxFloors > 0) {
        defaultFloors.push({
          projectId: result.insertedId,
          floorNumber: 0,
          name: 'Ground Floor',
          description: `Ground Floor of ${project.projectName || 'the building'}`,
          status: 'NOT_STARTED',
          startDate: null,
          completionDate: null,
          totalBudget: 0,
          actualCost: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        // Create above-ground floors (positive numbers)
        for (let i = 1; i <= maxFloors - 1; i++) {
          defaultFloors.push({
            projectId: result.insertedId,
            floorNumber: i,
            name: `Floor ${i}`,
            description: `Floor ${i} of ${project.projectName || 'the building'}`,
            status: 'NOT_STARTED',
            startDate: null,
            completionDate: null,
            totalBudget: 0,
            actualCost: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    // Insert floors if any were created
    if (defaultFloors.length > 0) {
      try {
        const insertResult = await db.collection('floors').insertMany(defaultFloors);
        floorsCreatedCount = insertResult?.insertedCount || defaultFloors.length;
        console.log(`✅ Auto-created ${floorsCreatedCount} floors for project ${insertedProject.projectCode}`);
      } catch (floorError) {
        // Log error but don't fail project creation
        console.error('Error auto-creating floors:', floorError);
        floorCreationWarning = {
          type: 'floor_creation_failed',
          message: 'Failed to auto-create floors',
          details: `Auto-creating ${defaultFloors.length} floor${defaultFloors.length !== 1 ? 's' : ''} failed. ` +
                   'The project was created, but floors were not added. You can create floors manually from the Floors page.',
          requestedCount: defaultFloors.length,
        };
        // Continue with project creation even if floor creation fails
      }
    }

    // Auto-initialize phases if requested
    let phaseInitializationWarning = null;
    let phasesCreated = false;
    if (autoInitializePhases !== false) {
      try {
        const { initializeDefaultPhases } = await import('@/lib/phase-helpers');
        const createdPhases = await initializeDefaultPhases(result.insertedId.toString(), insertedProject);
        phasesCreated = createdPhases && createdPhases.length > 0;
        console.log(`✅ Auto-initialized ${createdPhases.length} default phases for project ${insertedProject.projectCode}`);
      } catch (phaseError) {
        // Log error with full details
        console.error('Error auto-initializing phases:', phaseError);
        console.error('Phase initialization error stack:', phaseError.stack);
        
        // Create detailed warning for user
        phaseInitializationWarning = {
          type: 'phase_initialization_failed',
          message: phaseError.message || 'Failed to initialize default phases',
          details: `Phase initialization failed: ${phaseError.message || 'Unknown error'}. ` +
                   `The project was created successfully, but phases were not initialized. ` +
                   `You can initialize phases manually from the project detail page.`,
          actionUrl: `/projects/${result.insertedId.toString()}`,
          actionLabel: 'Go to Project',
          canRetry: true,
          retryUrl: `/api/projects/${result.insertedId.toString()}/phases/initialize`,
        };
        
        // Continue with project creation even if phase initialization fails
        // User can initialize phases manually later
      }
    } else {
      // Phases not auto-initialized - provide info
      phaseInitializationWarning = {
        type: 'phases_not_initialized',
        message: 'Phases were not auto-initialized',
        details: 'Phases were not automatically initialized. You can initialize them manually from the project detail page.',
        actionUrl: `/projects/${result.insertedId.toString()}`,
        actionLabel: 'Go to Project',
        canRetry: true,
        retryUrl: `/api/projects/${result.insertedId.toString()}/phases/initialize`,
      };
    }

    // Initialize project_finances record immediately after project creation
    // This ensures financial tracking is always available from the start
    let capitalInfo = null;
    try {
      await recalculateProjectFinances(result.insertedId.toString());
      console.log(`✅ Project finances initialized for project ${insertedProject.projectCode}`);
      
      // Check if capital is allocated to project
      try {
        const projectTotals = await calculateProjectTotals(result.insertedId.toString());
        const totalInvested = projectTotals.totalInvested || 0;
        
        if (totalInvested === 0) {
          capitalInfo = {
            message: 'No capital allocated to this project. Please allocate capital before creating materials.',
            totalInvested: 0,
          };
        }
      } catch (capitalError) {
        // Don't fail project creation if capital check fails
        console.error('Capital check error during project creation:', capitalError);
      }
    } catch (financeError) {
      // Log error but don't fail project creation
      // Finances will be created on first access via getProjectFinances()
      console.error(`Error initializing project finances for ${insertedProject.projectCode}:`, financeError);
      // Continue - finances will be created on-demand if needed
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PROJECT',
      entityId: result.insertedId.toString(),
      changes: { created: insertedProject },
    });

    // Include warnings and info in response
    const responseData = { ...insertedProject };
    const warnings = [];
    
    if (budgetWarning) {
      responseData.budgetWarning = budgetWarning;
      warnings.push(budgetWarning.message);
    }
    if (capitalInfo) {
      responseData.capitalInfo = capitalInfo;
      warnings.push(capitalInfo.message);
    }
    if (floorCreationWarning) {
      responseData.floorCreationWarning = floorCreationWarning;
      warnings.push(floorCreationWarning.message);
    }
    if (phaseInitializationWarning) {
      responseData.phaseInitializationWarning = phaseInitializationWarning;
      warnings.push(phaseInitializationWarning.message);
    }
    
    // Add summary of what was created
    responseData.creationSummary = {
      projectCreated: true,
      floorsCreated: floorsCreatedCount,
      floorsRequested: defaultFloors.length,
      phasesCreated: phasesCreated,
      financesInitialized: true,
      warnings: warnings.length > 0 ? warnings : null,
      hasWarnings: warnings.length > 0,
    };

    // Build success message with details
    let successMessage = 'Project created successfully';
    if (floorsCreatedCount > 0) {
      successMessage += `. ${floorsCreatedCount} floor${floorsCreatedCount !== 1 ? 's' : ''} created.`;
    }
    if (phasesCreated) {
      successMessage += ' Default phases initialized.';
    }
    if (warnings.length > 0) {
      successMessage += ` ${warnings.length} warning${warnings.length !== 1 ? 's' : ''} - see details below.`;
    }

    return successResponse(responseData, successMessage, 201);
  } catch (error) {
    console.error('Create project error:', error);
    return errorResponse('Failed to create project', 500);
  }
}

