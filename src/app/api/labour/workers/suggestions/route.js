/**
 * Worker Suggestions API Route
 * GET: Get suggested workers based on phase/project
 * 
 * GET /api/labour/workers/suggestions?phaseId=...&projectId=...&skillType=...
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/workers/suggestions
 * Returns workers who have worked on the specified phase/project
 * Auth: All authenticated users
 * Query params: phaseId, projectId, skillType, limit
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const phaseId = searchParams.get('phaseId');
    const projectId = searchParams.get('projectId');
    const skillType = searchParams.get('skillType');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!phaseId && !projectId) {
      return successResponse([], 'No suggestions available');
    }

    const db = await getDatabase();

    // Build query to find workers who have entries for this phase/project
    const entryQuery = {
      deletedAt: null,
      status: { $in: ['approved', 'paid'] },
    };

    if (phaseId && ObjectId.isValid(phaseId)) {
      entryQuery.phaseId = new ObjectId(phaseId);
    } else if (projectId && ObjectId.isValid(projectId)) {
      entryQuery.projectId = new ObjectId(projectId);
    }

    // Get distinct worker IDs from entries
    const workerIds = await db
      .collection('labour_entries')
      .distinct('workerId', entryQuery);

    if (workerIds.length === 0) {
      return successResponse([], 'No suggestions available');
    }

    // Build worker profile query
    const workerQuery = {
      deletedAt: null,
      $or: [
        { _id: { $in: workerIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } },
        { userId: { $in: workerIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } },
      ],
    };

    // Filter by skill type if provided
    if (skillType) {
      workerQuery.skillTypes = skillType;
    }

    // Get worker profiles
    const workers = await db
      .collection('worker_profiles')
      .find(workerQuery)
      .limit(limit)
      .toArray();

    // Sort by most recent entry date (workers with more recent entries first)
    const workersWithEntryDates = await Promise.all(
      workers.map(async (worker) => {
        const workerId = worker.userId || worker._id;
        const recentEntry = await db
          .collection('labour_entries')
          .findOne(
            {
              workerId: workerId,
              ...entryQuery,
            },
            {
              sort: { entryDate: -1 },
            }
          );

        return {
          ...worker,
          lastEntryDate: recentEntry?.entryDate || null,
          entryCount: await db.collection('labour_entries').countDocuments({
            workerId: workerId,
            ...entryQuery,
          }),
        };
      })
    );

    // Sort by entry count (descending) and then by last entry date (descending)
    workersWithEntryDates.sort((a, b) => {
      if (b.entryCount !== a.entryCount) {
        return b.entryCount - a.entryCount;
      }
      if (b.lastEntryDate && a.lastEntryDate) {
        return new Date(b.lastEntryDate) - new Date(a.lastEntryDate);
      }
      return 0;
    });

    // Remove temporary fields
    const suggestedWorkers = workersWithEntryDates.map(({ lastEntryDate, entryCount, ...worker }) => worker);

    return successResponse(suggestedWorkers, 'Worker suggestions retrieved successfully');
  } catch (error) {
    console.error('GET /api/labour/workers/suggestions error:', error);
    return errorResponse('Failed to retrieve worker suggestions', 500);
  }
}
