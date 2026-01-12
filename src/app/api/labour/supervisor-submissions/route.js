/**
 * Supervisor Submissions API Route
 * GET: List all supervisor submissions with filters
 * POST: Create new supervisor submission
 * 
 * GET /api/labour/supervisor-submissions
 * POST /api/labour/supervisor-submissions
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  createSupervisorSubmission,
  validateSupervisorSubmission,
  generateSubmissionNumber,
} from '@/lib/schemas/supervisor-submission-schema';
import {
  parseWhatsAppMessage,
  parseSMSMessage,
  parseEmailContent,
  parseStructuredText,
  validateParsedData,
  matchWorkersToProfiles,
  autoFillFromProfiles,
} from '@/lib/labour-parsing-helpers';

/**
 * GET /api/labour/supervisor-submissions
 * Returns supervisor submissions with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: projectId, phaseId, status, channel, submittedBy, page, limit
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const submittedBy = searchParams.get('submittedBy');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'submittedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = {};

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (status) {
      query.status = status;
    }

    if (channel) {
      query.submissionChannel = channel;
    }

    if (submittedBy) {
      query.submittedBy = { $regex: submittedBy, $options: 'i' };
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const submissions = await db
      .collection('supervisor_submissions')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const total = await db.collection('supervisor_submissions').countDocuments(query);

    return successResponse(
      {
        submissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Supervisor submissions retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/supervisor-submissions error:', error);
    return errorResponse('Failed to retrieve supervisor submissions', 500);
  }
}

/**
 * POST /api/labour/supervisor-submissions
 * Creates a new supervisor submission
 * Accepts data from multiple channels and auto-parses
 * Auth: All authenticated users (supervisors can submit)
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const {
      submissionChannel,
      rawText,
      projectId,
      phaseId,
      floorId,
      categoryId,
      entryDate,
      submittedBy,
      attachments = [],
      senderInfo = {},
      // Optional: pre-parsed entries (if parsing done client-side)
      labourEntries,
    } = body;

    // Validation
    if (!submissionChannel || !['whatsapp', 'email', 'sms', 'in_person'].includes(submissionChannel)) {
      return errorResponse('Valid submissionChannel is required', 400);
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!phaseId || !ObjectId.isValid(phaseId)) {
      return errorResponse('Valid phaseId is required', 400);
    }

    if (!entryDate) {
      return errorResponse('entryDate is required', 400);
    }

    if (!submittedBy || submittedBy.trim().length < 2) {
      return errorResponse('submittedBy is required and must be at least 2 characters', 400);
    }

    const db = await getDatabase();

    // Verify project and phase exist
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      projectId: new ObjectId(projectId),
      deletedAt: null,
    });

    if (!phase) {
      return errorResponse('Phase not found or does not belong to this project', 404);
    }

    // Parse data if not already provided
    let parsedEntries = labourEntries || [];

    if (!parsedEntries.length && rawText) {
      let parsed = [];

      switch (submissionChannel) {
        case 'whatsapp':
          parsed = parseWhatsAppMessage(rawText);
          break;
        case 'sms':
          parsed = parseSMSMessage(rawText);
          break;
        case 'email':
          // Email parsing is async, but for now use structured text
          parsed = parseStructuredText(rawText);
          break;
        case 'in_person':
          parsed = parseStructuredText(rawText);
          break;
        default:
          parsed = parseStructuredText(rawText);
      }

      // Validate parsed data
      const validation = validateParsedData(parsed);
      if (!validation.isValid) {
        return errorResponse(
          `Parsing validation failed: ${validation.errors.join(', ')}`,
          400
        );
      }

      parsedEntries = parsed;
    }

    // Match workers to profiles
    const workerNames = [...new Set(parsedEntries.map((e) => e.workerName))];
    const workerProfiles = await db.collection('worker_profiles').find({
      workerName: { $in: workerNames.map((n) => new RegExp(n, 'i')) },
      status: 'active',
    }).toArray();

    const workerMap = matchWorkersToProfiles(workerNames, workerProfiles);
    const enrichedEntries = autoFillFromProfiles(parsedEntries, workerMap);

    // Generate submission number
    const submissionNumber = await generateSubmissionNumber(new Date(entryDate));

    // Create submission object
    const submissionData = {
      submissionChannel,
      submissionData: {
        rawText: rawText || '',
        parsedData: {
          originalEntries: parsedEntries,
          enrichedEntries,
          workerMatches: workerMap,
        },
        attachments,
        senderInfo: {
          phone: senderInfo.phone || null,
          email: senderInfo.email || null,
          name: senderInfo.name || submittedBy,
        },
      },
      projectId,
      phaseId,
      floorId,
      categoryId,
      entryDate,
      labourEntries: enrichedEntries,
      submittedBy,
      status: 'pending_review',
    };

    const submission = createSupervisorSubmission(submissionData);
    submission.submissionNumber = submissionNumber;

    // Validate submission
    const submissionValidation = validateSupervisorSubmission(submission);
    if (!submissionValidation.isValid) {
      return errorResponse(
        `Submission validation failed: ${submissionValidation.errors.join(', ')}`,
        400
      );
    }

    // Insert submission
    const result = await db.collection('supervisor_submissions').insertOne(submission);

    const createdSubmission = { ...submission, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: 'CREATED',
      entityType: 'SUPERVISOR_SUBMISSION',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: {
        created: createdSubmission,
        channel: submissionChannel,
        entryCount: enrichedEntries.length,
      },
    });

    // TODO: Send notification to owner about new submission

    return successResponse(
      {
        submission: createdSubmission,
        parsing: {
          originalCount: parsedEntries.length,
          enrichedCount: enrichedEntries.length,
          workerMatches: Object.keys(workerMap).length,
        },
      },
      'Supervisor submission created and ready for review'
    );
  } catch (error) {
    console.error('POST /api/labour/supervisor-submissions error:', error);
    return errorResponse(error.message || 'Failed to create supervisor submission', 500);
  }
}

