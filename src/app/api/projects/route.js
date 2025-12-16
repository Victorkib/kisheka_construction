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
import { calculateProjectTotals } from '@/lib/investment-allocation';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const archived = searchParams.get('archived');

    const db = await getDatabase();

    // Build query
    const query = {};

    // Archive filter: if archived=true, show only archived; if archived=false or not set, exclude archived
    if (archived === 'true') {
      query.status = 'archived';
    } else if (archived === 'false' || !archived) {
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
          
          return {
            ...project,
            statistics: {
              totalInvested,
              capitalBalance,
              budgetVsCapitalWarning: project.budget?.total > totalInvested && totalInvested > 0
                ? `Budget (${project.budget.total.toLocaleString()}) exceeds capital (${totalInvested.toLocaleString()})`
                : null,
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
    const budgetTotal = budget?.total || 0;
    
    // Optional: Require budget > 0 (configurable)
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
      budget: {
        total: budgetTotal,
        materials: budget?.materials || 0,
        labour: budget?.labour || 0,
        contingency: budget?.contingency || 0,
        spent: 0, // Computed field
      },
      siteManager: null,
      teamMembers: [],
      createdBy: new ObjectId(userProfile._id),
      createdAt: new Date(),
      updatedAt: new Date(),
      documents: [],
      metadata: {
        contractValue: budget?.total || 0,
        estimatedDuration: null,
        completionPercentage: 0,
      },
    };

    const result = await db.collection('projects').insertOne(project);

    const insertedProject = { ...project, _id: result.insertedId };

    // Auto-create floors (configurable)
    const defaultFloors = [];
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
        await db.collection('floors').insertMany(defaultFloors);
        console.log(`✅ Auto-created ${defaultFloors.length} floors for project ${insertedProject.projectCode}`);
      } catch (floorError) {
        // Log error but don't fail project creation
        console.error('Error auto-creating floors:', floorError);
        // Continue with project creation even if floor creation fails
      }
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

    // Include budget warning and capital info in response if present
    const responseData = { ...insertedProject };
    if (budgetWarning) {
      responseData.budgetWarning = budgetWarning;
    }
    if (capitalInfo) {
      responseData.capitalInfo = capitalInfo;
    }

    return successResponse(responseData, 'Project created successfully', 201);
  } catch (error) {
    console.error('Create project error:', error);
    return errorResponse('Failed to create project', 500);
  }
}

