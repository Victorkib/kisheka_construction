/**
 * Professional Fees Constants
 * Client-safe constants for professional fees (no MongoDB imports)
 * These can be safely imported in client components
 */

/**
 * Valid fee types
 */
export const FEE_TYPES = {
  ARCHITECT: [
    'design_fee',
    'revision_fee',
    'site_visit',
    'retainer',
    'milestone_payment',
    'lump_sum',
    'consultation_fee',
  ],
  ENGINEER: [
    'inspection_fee',
    'quality_control_fee',
    'site_visit',
    'retainer',
    'testing_fee',
    'consultation_fee',
  ],
  ALL: [
    'design_fee',
    'revision_fee',
    'site_visit',
    'retainer',
    'milestone_payment',
    'lump_sum',
    'consultation_fee',
    'inspection_fee',
    'quality_control_fee',
    'testing_fee',
  ],
};

/**
 * Valid fee statuses (UPPERCASE like expenses)
 */
export const FEE_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PAID',
  'ARCHIVED',
];

/**
 * Valid payment methods
 */
export const PAYMENT_METHODS = [
  'CASH',
  'M_PESA',
  'BANK_TRANSFER',
  'CHEQUE',
  'OTHER',
];

/**
 * Valid currencies
 */
export const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP'];

/**
 * Valid approval chain statuses
 */
export const APPROVAL_CHAIN_STATUSES = ['pending', 'approved', 'rejected'];

