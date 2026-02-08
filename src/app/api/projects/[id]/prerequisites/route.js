/**
 * Project Prerequisites API Route
 * GET: Check project setup prerequisites and readiness
 * 
 * GET /api/projects/[id]/prerequisites
 * Returns: Checklist of prerequisites with status
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import { getProjectFinances } from '@/lib/financial-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();
    const projectId = new ObjectId(id);

    // Get project
    const project = await db.collection('projects').findOne({
      _id: projectId,
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Check budget
    const budget = project.budget || {};
    const hasBudget = budget.total > 0;
    const budgetTotal = budget.total || 0;
    const budgetMaterials = budget.materials || 0;
    const budgetWarning = budgetTotal === 0 ? 'Project has no budget set' : null;

    // Check capital allocation
    const projectTotals = await calculateProjectTotals(id);
    const totalInvested = projectTotals.totalInvested || 0;
    const hasCapital = totalInvested > 0;
    const capitalWarning = totalInvested === 0 ? 'No capital allocated to this project' : null;

    // Get project finances for more details
    const finances = await getProjectFinances(id);
    const totalUsed = finances?.totalUsed || 0;
    const committedCost = finances?.committedCost || 0;
    const availableCapital = totalInvested - totalUsed - committedCost;
    const capitalStatus = totalInvested === 0 
      ? 'none' 
      : availableCapital <= 0 
        ? 'depleted' 
        : availableCapital < (totalInvested * 0.1)
          ? 'low'
          : 'sufficient';

    // Check phases
    const phases = await db.collection('phases').countDocuments({
      projectId: projectId,
      deletedAt: null,
    });
    const hasPhases = phases > 0;
    const phasesCount = phases;

    // Check floors
    const floors = await db.collection('floors').countDocuments({
      projectId: projectId,
      deletedAt: null,
    });
    const hasFloors = floors > 0;
    const floorsCount = floors;

    // Check suppliers (global, not project-specific)
    const suppliers = await db.collection('suppliers').countDocuments({
      status: 'active',
      deletedAt: null,
    });
    const hasSuppliers = suppliers > 0;
    const suppliersCount = suppliers;

    // Check categories (global)
    const categories = await db.collection('categories').countDocuments({
      deletedAt: null,
    });
    const hasCategories = categories > 0;
    const categoriesCount = categories;

    // Determine readiness
    const readyForMaterials = hasBudget && hasCapital && hasFloors && hasPhases; // Phases now required
    const readyForPurchaseOrders = readyForMaterials && hasSuppliers;
    const overallReadiness = {
      readyForMaterials,
      readyForPurchaseOrders,
      completionPercentage: calculateCompletionPercentage({
        hasBudget,
        hasCapital,
        hasFloors,
        hasPhases,
        hasSuppliers,
        hasCategories,
      }),
    };

    // Build prerequisites checklist
    const prerequisites = {
      phases: {
        completed: hasPhases,
        required: true, // Phases are now required for material requests
        status: hasPhases ? 'complete' : 'missing',
        message: hasPhases 
          ? `${phasesCount} phase${phasesCount !== 1 ? 's' : ''} initialized`
          : 'No phases initialized',
        warning: !hasPhases ? 'Phases are required for material requests and phase-based tracking' : null,
        details: {
          count: phasesCount,
        },
        actionUrl: `/api/projects/${id}/phases/initialize`,
        actionLabel: 'Initialize Phases',
        actionType: 'api_call', // Special handling for API endpoint
      },
      budget: {
        completed: hasBudget,
        required: true,
        status: hasBudget ? 'complete' : 'missing',
        message: hasBudget 
          ? `Budget set: ${budgetTotal.toLocaleString()} KES` 
          : 'No budget set',
        warning: budgetWarning,
        details: {
          total: budgetTotal,
          materials: budgetMaterials,
          labour: budget.labour || 0,
          contingency: budget.contingency || 0,
        },
        actionUrl: `/projects/${id}/edit`,
        actionLabel: 'Set Budget',
      },
      capital: {
        completed: hasCapital,
        required: true,
        status: capitalStatus,
        message: hasCapital 
          ? `Capital allocated: ${totalInvested.toLocaleString()} KES (Available: ${Math.max(0, availableCapital).toLocaleString()} KES)`
          : 'No capital allocated',
        warning: capitalWarning,
        details: {
          totalInvested,
          totalUsed,
          committedCost,
          availableCapital: Math.max(0, availableCapital),
          capitalStatus,
        },
        actionUrl: '/financing',
        actionLabel: 'Allocate Capital',
      },
      floors: {
        completed: hasFloors,
        required: true,
        status: hasFloors ? 'complete' : 'missing',
        message: hasFloors 
          ? `${floorsCount} floor${floorsCount !== 1 ? 's' : ''} created`
          : 'No floors created',
        warning: !hasFloors ? 'Floors should be created (usually auto-created)' : null,
        details: {
          count: floorsCount,
        },
        actionUrl: `/floors/new?projectId=${id}`,
        actionLabel: 'Create Floors',
      },
      suppliers: {
        completed: hasSuppliers,
        required: false, // Optional but recommended
        status: hasSuppliers ? 'complete' : 'missing',
        message: hasSuppliers 
          ? `${suppliersCount} active supplier${suppliersCount !== 1 ? 's' : ''} available`
          : 'No suppliers created',
        warning: !hasSuppliers ? 'Suppliers needed for purchase orders' : null,
        details: {
          count: suppliersCount,
        },
        actionUrl: '/suppliers/new',
        actionLabel: 'Create Supplier',
      },
      categories: {
        completed: hasCategories,
        required: false, // Optional
        status: hasCategories ? 'complete' : 'missing',
        message: hasCategories 
          ? `${categoriesCount} categor${categoriesCount !== 1 ? 'ies' : 'y'} available`
          : 'No categories created',
        warning: !hasCategories ? 'Categories help organize materials' : null,
        details: {
          count: categoriesCount,
        },
        actionUrl: '/categories',
        actionLabel: 'Manage Categories',
      },
    };

    return successResponse({
      projectId: id,
      projectName: project.projectName,
      projectCode: project.projectCode,
      prerequisites,
      readiness: overallReadiness,
      summary: {
        totalItems: 6, // Updated to include phases
        completedItems: Object.values(prerequisites).filter(p => p.completed).length,
        requiredItems: Object.values(prerequisites).filter(p => p.required).length,
        completedRequiredItems: Object.values(prerequisites).filter(p => p.required && p.completed).length,
      },
    });
  } catch (err) {
    console.error('Error checking project prerequisites:', err);
    return errorResponse('Failed to check project prerequisites', 500);
  }
}

/**
 * Calculate completion percentage
 */
function calculateCompletionPercentage({ hasBudget, hasCapital, hasFloors, hasPhases, hasSuppliers, hasCategories }) {
  const required = [hasBudget, hasCapital, hasFloors, hasPhases]; // Phases now required
  const optional = [hasSuppliers, hasCategories];
  
  const requiredCompleted = required.filter(Boolean).length;
  const optionalCompleted = optional.filter(Boolean).length;
  
  // Required items are 70% weight, optional are 30%
  const requiredPercentage = (requiredCompleted / required.length) * 70;
  const optionalPercentage = (optionalCompleted / optional.length) * 30;
  
  return Math.round(requiredPercentage + optionalPercentage);
}

