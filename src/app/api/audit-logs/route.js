/**
 * Audit Logs API Route
 * GET: Get audit logs for a specific entity
 * 
 * GET /api/audit-logs?entityType=MATERIAL&entityId=xxx
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEntityAuditLogs } from '@/lib/audit-log';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/audit-logs
 * Returns audit logs for a specific entity
 * Query params: entityType (required), entityId (required), limit (optional)
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

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!entityType || !entityId) {
      return errorResponse('entityType and entityId are required', 400);
    }

    if (!ObjectId.isValid(entityId)) {
      return errorResponse('Invalid entityId', 400);
    }

    const logs = await getEntityAuditLogs(entityType, entityId, { limit });

    // Enrich logs with user information
    const db = await getDatabase();
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        if (log.userId) {
          try {
            const user = await db.collection('users').findOne({
              _id: new ObjectId(log.userId),
            });
            if (user) {
              return {
                ...log,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                userEmail: user.email,
              };
            }
          } catch (err) {
            console.error('Error fetching user for audit log:', err);
          }
        }
        return log;
      })
    );

    return successResponse({
      logs: enrichedLogs,
      total: enrichedLogs.length,
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return errorResponse('Failed to retrieve audit logs', 500);
  }
}

