/**
 * Phase Template Application API Route
 * Applies a phase template to a project, creating phases, work items, and milestones
 * 
 * POST /api/phase-templates/[id]/apply
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createPhase } from '@/lib/schemas/phase-schema';
import { getBudgetTotal } from '@/lib/schemas/budget-schema';
import { createMilestone } from '@/lib/milestone-helpers';

/**
 * POST /api/phase-templates/[id]/apply
 * Apply template to a project
 * Auth: PM, OWNER only
 */
export async function POST(request, { params }) {
  try {
    const db = await getDatabase();
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const canApply = await hasPermission(user.id, 'edit_phase');
    if (!canApply) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can apply phase templates.', 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { projectId } = body;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid template ID', 400);
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get template
    const template = await db.collection('phase_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!template) {
      return errorResponse('Template not found', 404);
    }

    // Get project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get project budget
    const totalBudget = getBudgetTotal(project.budget || {});

    if (totalBudget <= 0) {
      return errorResponse('Project must have a budget before applying template', 400);
    }

    // Check if project already has phases
    const existingPhases = await db.collection('phases').countDocuments({
      projectId: new ObjectId(projectId),
      deletedAt: null
    });

    if (existingPhases > 0) {
      return errorResponse('Project already has phases. Cannot apply template to existing project.', 400);
    }

    // Create phases from template
    const createdPhases = [];
    
    for (const phaseDef of template.phases) {
      // Calculate phase budget
      const phaseBudgetPercentage = phaseDef.defaultBudgetPercentage || 0;
      const phaseBudgetTotal = totalBudget * (phaseBudgetPercentage / 100);
      
      const phaseBudget = {
        total: phaseBudgetTotal,
        materials: phaseBudgetTotal * ((template.defaultBudgetAllocation.materials || 0) / 100),
        labour: phaseBudgetTotal * ((template.defaultBudgetAllocation.labour || 0) / 100),
        equipment: phaseBudgetTotal * ((template.defaultBudgetAllocation.equipment || 0) / 100),
        subcontractors: phaseBudgetTotal * ((template.defaultBudgetAllocation.subcontractors || 0) / 100),
        contingency: 0  // Contingency NOT allocated to phases - stays at project level
      };

      // Create phase
      const phase = createPhase({
        phaseName: phaseDef.phaseName,
        phaseCode: phaseDef.phaseCode,
        phaseType: phaseDef.phaseType,
        sequence: phaseDef.sequence,
        description: phaseDef.description,
        budgetAllocation: phaseBudget
      }, new ObjectId(projectId));

      const phaseResult = await db.collection('phases').insertOne(phase);
      const createdPhase = { ...phase, _id: phaseResult.insertedId };
      createdPhases.push(createdPhase);

      // Create default work items if template has them
      if (phaseDef.defaultWorkItems && Array.isArray(phaseDef.defaultWorkItems) && phaseDef.defaultWorkItems.length > 0) {
        const workItemsToInsert = phaseDef.defaultWorkItems.map(workItemName => ({
          phaseId: phaseResult.insertedId,
          projectId: new ObjectId(projectId),
          name: workItemName.trim(),
          description: '',
          category: 'general',
          status: 'not_started',
          assignedTo: null,
          estimatedHours: 0,
          actualHours: 0,
          estimatedCost: 0,
          actualCost: 0,
          startDate: null,
          plannedEndDate: null,
          actualEndDate: null,
          dependencies: [],
          floorId: null,
          categoryId: null,
          priority: 3,
          notes: '',
          createdBy: new ObjectId(userProfile._id),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null
        }));

        if (workItemsToInsert.length > 0) {
          await db.collection('work_items').insertMany(workItemsToInsert);
        }
      }

      // Create default milestones if template has them
      if (phaseDef.defaultMilestones && Array.isArray(phaseDef.defaultMilestones) && phaseDef.defaultMilestones.length > 0) {
        const milestones = phaseDef.defaultMilestones.map(milestoneName => {
          const milestone = createMilestone({
            name: milestoneName.trim(),
            description: '',
            targetDate: null,
            completionCriteria: [],
            signOffRequired: false
          });
          return milestone;
        });

        await db.collection('phases').updateOne(
          { _id: phaseResult.insertedId },
          { 
            $set: { 
              milestones: milestones,
              updatedAt: new Date() 
            } 
          }
        );
      }
    }

    // Update template usage statistics
    await db.collection('phase_templates').updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date(), updatedAt: new Date() }
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPLIED',
      entityType: 'PHASE_TEMPLATE',
      entityId: id,
      projectId: projectId,
      changes: { 
        templateName: template.templateName,
        phasesCreated: createdPhases.length,
        projectId: projectId
      }
    });

    return successResponse({
      phases: createdPhases.map(p => ({
        _id: p._id,
        phaseName: p.phaseName,
        phaseCode: p.phaseCode,
        sequence: p.sequence
      })),
      template: template.templateName,
      phasesCount: createdPhases.length
    }, 'Template applied successfully', 201);
  } catch (error) {
    console.error('Apply template error:', error);
    return errorResponse(error.message || 'Failed to apply template', 500);
  }
}

