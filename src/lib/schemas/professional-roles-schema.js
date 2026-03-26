/**
 * Professional Roles Schema Definition
 * Data-driven catalog of professional roles (Architect, Engineer, QS, etc.)
 *
 * NOTE: This is server-only and should not be imported in client components.
 */

import { ObjectId } from 'mongodb';

export const PROFESSIONAL_ROLES_SCHEMA = {
  code: String, // e.g. 'ARCH', 'ENG', 'QS'
  slug: String, // e.g. 'architect', 'engineer', 'quantity_surveyor'
  name: String, // e.g. 'Architect'
  kind: String, // 'professional' | 'technician' | 'consultant' | etc.
  description: String,
  defaultContractTypes: [String],
  defaultFeeTypes: [String],
  supportsSpecializations: Boolean,
  specializationOptions: [String],
  defaultRateFields: [String], // e.g. ['hourly', 'per_floor', 'retainer']
  isActive: Boolean,
  sortOrder: Number,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date,
};

export const PROFESSIONAL_ROLES_VALIDATION = {
  code: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 10,
  },
  slug: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50,
  },
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
  },
  kind: {
    required: false,
    type: 'string',
  },
  defaultContractTypes: {
    required: false,
    type: 'array',
  },
  defaultFeeTypes: {
    required: false,
    type: 'array',
  },
  supportsSpecializations: {
    required: false,
    type: 'boolean',
  },
  specializationOptions: {
    required: false,
    type: 'array',
  },
  defaultRateFields: {
    required: false,
    type: 'array',
  },
  isActive: {
    required: false,
    type: 'boolean',
    default: true,
  },
};

export async function ensureDefaultProfessionalRoles(db) {
  const existingCount = await db.collection('professional_roles').countDocuments({ deletedAt: null });
  if (existingCount > 0) return;

  const now = new Date();
  const defaults = [
    {
      code: 'ARCH',
      slug: 'architect',
      name: 'Architect',
      kind: 'professional',
      defaultContractTypes: ['full_service', 'design_only', 'oversight_only', 'consultation'],
      defaultFeeTypes: ['design_fee', 'revision_fee', 'site_visit', 'retainer'],
      supportsSpecializations: false,
      specializationOptions: [],
      defaultRateFields: ['hourly', 'per_floor', 'retainer'],
      isActive: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      code: 'ENG',
      slug: 'engineer',
      name: 'Engineer',
      kind: 'professional',
      defaultContractTypes: ['inspection_only', 'full_oversight', 'quality_control', 'consultation'],
      defaultFeeTypes: ['inspection_fee', 'site_visit', 'quality_control_fee', 'retainer'],
      supportsSpecializations: true,
      specializationOptions: ['structural', 'construction', 'quality_control', 'mep'],
      defaultRateFields: ['hourly', 'per_floor', 'retainer'],
      isActive: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      code: 'QS',
      slug: 'quantity_surveyor',
      name: 'Quantity Surveyor',
      kind: 'professional',
      defaultContractTypes: ['consultation', 'full_service'],
      defaultFeeTypes: ['consultation_fee', 'lump_sum', 'milestone_payment'],
      supportsSpecializations: false,
      specializationOptions: [],
      defaultRateFields: ['hourly', 'retainer'],
      isActive: true,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  ];

  await db.collection('professional_roles').insertMany(defaults);
}

export async function getActiveProfessionalRoles(db) {
  await ensureDefaultProfessionalRoles(db);
  return db
    .collection('professional_roles')
    .find({ isActive: true, deletedAt: null })
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
}

