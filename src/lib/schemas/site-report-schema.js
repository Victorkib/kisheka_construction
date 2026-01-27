/**
 * Site Report Schema Definition
 * Structured field reports for site updates with optional labour linkage.
 */

import { ObjectId } from 'mongodb';

export const VALID_SITE_REPORT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'converted',
];

export const VALID_SITE_REPORT_CHANNELS = [
  'in_person',
  'whatsapp',
  'sms',
  'email',
];

export const SITE_REPORT_SCHEMA = {
  reportNumber: String,
  projectId: 'ObjectId',
  phaseId: 'ObjectId',
  floorId: 'ObjectId',
  workItemIds: ['ObjectId'],
  entryDate: Date,
  submissionChannel: String,
  reportedByUserId: 'ObjectId',
  reportedByName: String,
  reportedByRole: String,
  summary: String,
  notes: String,
  labourEntries: [
    {
      workerId: 'ObjectId',
      workerName: String,
      skillType: String,
      hours: Number,
      hourlyRate: Number,
      taskDescription: String,
      workItemId: 'ObjectId',
    },
  ],
  attachments: [
    {
      url: String,
      publicId: String,
      fileName: String,
      fileType: String,
      fileSize: Number,
      category: String,
      uploadedAt: Date,
    },
  ],
  status: String,
  labourBatchId: 'ObjectId',
  labourBatchNumber: String,
  reviewedBy: 'ObjectId',
  reviewedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date,
};

export function validateSiteReport(data) {
  const errors = [];

  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
    errors.push('Valid phaseId is required');
  }

  if (data.floorId && !ObjectId.isValid(data.floorId)) {
    errors.push('floorId must be a valid ObjectId');
  }

  if (!data.entryDate) {
    errors.push('entryDate is required');
  }

  if (!data.reportedByName || data.reportedByName.trim().length < 2) {
    errors.push('reportedByName is required and must be at least 2 characters');
  }

  if (
    !data.submissionChannel ||
    !VALID_SITE_REPORT_CHANNELS.includes(data.submissionChannel)
  ) {
    errors.push(
      `submissionChannel must be one of: ${VALID_SITE_REPORT_CHANNELS.join(', ')}`
    );
  }

  if (data.workItemIds && Array.isArray(data.workItemIds)) {
    const invalid = data.workItemIds.some(
      (id) => !ObjectId.isValid(id)
    );
    if (invalid) {
      errors.push('workItemIds must contain valid ObjectIds');
    }
  }

  if (data.labourEntries && Array.isArray(data.labourEntries)) {
    data.labourEntries.forEach((entry, index) => {
      if (!entry.workerName || entry.workerName.trim().length < 2) {
        errors.push(`Entry ${index + 1}: workerName is required`);
      }
      if (!entry.skillType) {
        errors.push(`Entry ${index + 1}: skillType is required`);
      }
      if (entry.hours === undefined || isNaN(entry.hours) || entry.hours <= 0) {
        errors.push(`Entry ${index + 1}: hours must be > 0`);
      }
      if (
        entry.hourlyRate === undefined ||
        isNaN(entry.hourlyRate) ||
        entry.hourlyRate < 0
      ) {
        errors.push(`Entry ${index + 1}: hourlyRate must be >= 0`);
      }
      if (entry.workItemId && !ObjectId.isValid(entry.workItemId)) {
        errors.push(`Entry ${index + 1}: workItemId must be valid`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function generateSiteReportNumber(date = new Date()) {
  const { getDatabase } = await import('@/lib/mongodb/connection');
  const db = await getDatabase();

  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `SR-${dateStr}`;

  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(date);
  todayEnd.setHours(23, 59, 59, 999);

  const lastReport = await db.collection('site_reports').findOne(
    {
      reportNumber: { $regex: `^${prefix}-` },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    },
    { sort: { reportNumber: -1 } }
  );

  let sequence = 1;
  if (lastReport?.reportNumber) {
    const lastSequence = parseInt(lastReport.reportNumber.split('-').pop(), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

export function createSiteReport(input) {
  const {
    reportNumber,
    projectId,
    phaseId,
    floorId,
    workItemIds = [],
    entryDate,
    submissionChannel = 'in_person',
    reportedByUserId,
    reportedByName,
    reportedByRole,
    summary = '',
    notes = '',
    labourEntries = [],
    attachments = [],
    status = 'submitted',
  } = input;

  return {
    reportNumber: reportNumber || null,
    projectId: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId,
    phaseId: ObjectId.isValid(phaseId) ? new ObjectId(phaseId) : phaseId,
    floorId: floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null,
    workItemIds: Array.isArray(workItemIds)
      ? workItemIds
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id))
      : [],
    entryDate: entryDate ? new Date(entryDate) : new Date(),
    submissionChannel,
    reportedByUserId: reportedByUserId && ObjectId.isValid(reportedByUserId)
      ? new ObjectId(reportedByUserId)
      : null,
    reportedByName: reportedByName?.trim() || '',
    reportedByRole: reportedByRole || null,
    summary: summary?.trim() || '',
    notes: notes?.trim() || '',
    labourEntries: Array.isArray(labourEntries) ? labourEntries : [],
    attachments: Array.isArray(attachments) ? attachments : [],
    status,
    labourBatchId: null,
    labourBatchNumber: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}
