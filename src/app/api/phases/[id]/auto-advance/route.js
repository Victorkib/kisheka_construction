/**
 * Phase Auto-Advance API Route
 * Automatically advances a phase to completed status when all criteria are met
 * 
 * POST /api/phases/[id]/auto-advance
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { successResponse, errorResponse } from '@/lib/api-response';
import { autoAdvancePhase, canPhaseAutoAdvance } from '@/lib/phase-automation';

/**
 * POST /api/phases/[id]/auto-advance
 * Auto-advance phase to completed
 * Auth: PM, OWNER only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const canAdvance = await hasPermission(user.id, 'edit_phase');
    if (!canAdvance) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can auto-advance phases.', 403);
    }

    const { id } = await params;
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check if phase can be auto-advanced
    const canAdvanceCheck = await canPhaseAutoAdvance(id);
    if (!canAdvanceCheck.canAdvance) {
      return errorResponse(`Cannot auto-advance phase: ${canAdvanceCheck.reason}`, 400);
    }

    // Auto-advance the phase
    const updatedPhase = await autoAdvancePhase(id);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'AUTO_ADVANCED',
      entityType: 'PHASE',
      entityId: id,
      projectId: updatedPhase.projectId.toString(),
      changes: { 
        status: 'completed',
        completionPercentage: 100,
        actualEndDate: updatedPhase.actualEndDate
      }
    });

    return successResponse(updatedPhase, 'Phase auto-advanced successfully');
  } catch (error) {
    console.error('Auto-advance phase error:', error);
    return errorResponse(error.message || 'Failed to auto-advance phase', 500);
  }
}

/**
 * GET /api/phases/[id]/auto-advance
 * Check if phase can be auto-advanced
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    const canAdvanceCheck = await canPhaseAutoAdvance(id);

    return successResponse(canAdvanceCheck, 'Auto-advance check completed');
  } catch (error) {
    console.error('Check auto-advance error:', error);
    return errorResponse('Failed to check auto-advance status', 500);
  }
}


