/**
 * Parse Data API Route
 * POST: Parse data without creating submission (preview)
 * 
 * POST /api/labour/supervisor-submissions/parse
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  parseWhatsAppMessage,
  parseSMSMessage,
  parseStructuredText,
  validateParsedData,
  matchWorkersToProfiles,
  autoFillFromProfiles,
} from '@/lib/labour-parsing-helpers';
import { getDatabase } from '@/lib/mongodb/connection';

/**
 * POST /api/labour/supervisor-submissions/parse
 * Parse data without creating submission (for preview)
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { rawText, submissionChannel, workerNames = [] } = body;

    if (!rawText || typeof rawText !== 'string') {
      return errorResponse('rawText is required', 400);
    }

    if (!submissionChannel || !['whatsapp', 'email', 'sms', 'in_person'].includes(submissionChannel)) {
      return errorResponse('Valid submissionChannel is required', 400);
    }

    // Parse data based on channel
    let parsedEntries = [];

    switch (submissionChannel) {
      case 'whatsapp':
        parsedEntries = parseWhatsAppMessage(rawText);
        break;
      case 'sms':
        parsedEntries = parseSMSMessage(rawText);
        break;
      case 'email':
      case 'in_person':
        parsedEntries = parseStructuredText(rawText);
        break;
      default:
        parsedEntries = parseStructuredText(rawText);
    }

    // Validate parsed data
    const validation = validateParsedData(parsedEntries);
    if (!validation.isValid) {
      return errorResponse(
        `Parsing validation failed: ${validation.errors.join(', ')}`,
        400
      );
    }

    // Match workers to profiles if worker names provided
    let workerMap = {};
    if (workerNames.length > 0 || parsedEntries.length > 0) {
      const db = await getDatabase();
      const namesToMatch = workerNames.length > 0 
        ? workerNames 
        : [...new Set(parsedEntries.map((e) => e.workerName))];

      const workerProfiles = await db.collection('worker_profiles').find({
        workerName: { $in: namesToMatch.map((n) => new RegExp(n, 'i')) },
        status: 'active',
      }).toArray();

      workerMap = matchWorkersToProfiles(namesToMatch, workerProfiles);
    }

    // Enrich entries with profile data
    const enrichedEntries = autoFillFromProfiles(parsedEntries, workerMap);

    // Calculate totals
    const totals = enrichedEntries.reduce(
      (acc, entry) => {
        const hours = parseFloat(entry.hours) || 0;
        const rate = parseFloat(entry.hourlyRate) || 0;
        const cost = hours * rate;

        return {
          totalHours: acc.totalHours + hours,
          totalCost: acc.totalCost + cost,
          entryCount: acc.entryCount + 1,
        };
      },
      { totalHours: 0, totalCost: 0, entryCount: 0 }
    );

    return successResponse(
      {
        parsedEntries: enrichedEntries,
        originalEntries: parsedEntries,
        workerMatches: workerMap,
        totals,
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
        },
      },
      'Data parsed successfully'
    );
  } catch (error) {
    console.error('POST /api/labour/supervisor-submissions/parse error:', error);
    return errorResponse(error.message || 'Failed to parse data', 500);
  }
}

