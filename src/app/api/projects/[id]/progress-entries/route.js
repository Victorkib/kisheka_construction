/**
 * Project Progress Entries API
 * Evidence model for photos/notes tagged to project / floor / phase.
 *
 * GET  /api/projects/[id]/progress-entries
 * POST /api/projects/[id]/progress-entries
 *
 * Auth: authenticated users only
 * Permissions:
 *   - OWNER / PM / site_clerk can CREATE
 *   - OWNER / PM can DELETE (handled in /api/progress-entries/[entryId])
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';
import { ObjectId } from 'mongodb';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/progress-entries
 * Query params:
 *   - floorId (optional)
 *   - phaseId (optional)
 *   - type    (optional: 'photo' | 'note')
 *   - from    (optional ISO date)
 *   - to      (optional ISO date)
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const floorId = searchParams.get('floorId');
    const phaseId = searchParams.get('phaseId');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const db = await getDatabase();

    const query = {
      projectId: new ObjectId(id),
      deletedAt: null,
    };

    if (floorId && ObjectId.isValid(floorId)) {
      query.floorId = new ObjectId(floorId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (type && ['photo', 'note'].includes(type)) {
      query.type = type;
    }

    const dateFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        dateFilter.$gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        dateFilter.$lte = toDate;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }

    const entries = await db
      .collection('progress_entries')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return successResponse(entries, 'Progress entries retrieved successfully');
  } catch (error) {
    console.error('Get progress entries error:', error);
    return errorResponse('Failed to retrieve progress entries', 500);
  }
}

/**
 * POST /api/projects/[id]/progress-entries
 * Body:
 *   - type: 'photo' | 'note'
 *   - text?: string (for notes or captions)
 *   - media?: { url: string, publicId?: string, fileType?: string, width?: number, height?: number }
 *   - floorId?: string
 *   - phaseId?: string
 *   - tags?: string[]
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Permissions: OWNER / PM / site_clerk can create
    const role = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager', 'site_clerk', 'clerk'];
    if (!allowedRoles.includes(role)) {
      return errorResponse('Insufficient permissions to add progress entries', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();

    // Ensure project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });
    if (!project) {
      return errorResponse('Project not found', 404);
    }

    const body = await request.json();
    const { type, text, media, floorId, phaseId, tags } = body || {};

    if (!type || !['photo', 'note'].includes(type)) {
      return errorResponse('Invalid type. Must be "photo" or "note"', 400);
    }

    if (type === 'photo') {
      if (!media || !media.url) {
        return errorResponse('Media with URL is required for photo entries', 400);
      }
    }

    if (type === 'note' && (!text || !text.trim())) {
      return errorResponse('Text is required for note entries', 400);
    }

    const now = new Date();
    const entry = {
      projectId: new ObjectId(id),
      type,
      text: text?.trim() || null,
      media: media?.url
        ? {
            url: media.url,
            publicId: media.publicId || null,
            fileType: media.fileType || null,
            width: media.width || null,
            height: media.height || null,
          }
        : null,
      floorId: floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null,
      phaseId: phaseId && ObjectId.isValid(phaseId) ? new ObjectId(phaseId) : null,
      tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
      createdAt: now,
      updatedAt: now,
      createdBy: userProfile._id,
      updatedBy: userProfile._id,
      deletedAt: null,
    };

    const result = await db.collection('progress_entries').insertOne(entry);
    const inserted = await db.collection('progress_entries').findOne({
      _id: result.insertedId,
    });

    return successResponse(inserted, 'Progress entry created successfully', 201);
  } catch (error) {
    console.error('Create progress entry error:', error);
    return errorResponse('Failed to create progress entry', 500);
  }
}

