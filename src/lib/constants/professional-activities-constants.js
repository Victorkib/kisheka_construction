/**
 * Professional Activities Constants
 * Client-safe constants for professional activities (no MongoDB imports)
 * These can be safely imported in client components
 */

/**
 * Valid activity types
 */
export const ACTIVITY_TYPES = {
  ARCHITECT: [
    'site_visit',
    'design_revision',
    'client_meeting',
    'document_upload',
    'approval_submission',
    'progress_review',
  ],
  ENGINEER: [
    'inspection',
    'quality_check',
    'compliance_verification',
    'issue_resolution',
    'material_test',
    'document_upload',
  ],
  ALL: [
    'site_visit',
    'design_revision',
    'client_meeting',
    'inspection',
    'quality_check',
    'compliance_verification',
    'issue_resolution',
    'material_test',
    'document_upload',
    'approval_submission',
    'progress_review',
  ],
};

/**
 * Valid visit purposes (for architects)
 */
export const VISIT_PURPOSES = [
  'design_verification',
  'quality_check',
  'progress_review',
  'issue_resolution',
  'client_meeting',
  'site_survey',
];

/**
 * Valid inspection types (for engineers)
 */
export const INSPECTION_TYPES = [
  'routine',
  'milestone',
  'quality_control',
  'compliance',
  'issue_followup',
  'final',
];

/**
 * Valid compliance statuses
 */
export const COMPLIANCE_STATUSES = [
  'compliant',
  'non_compliant',
  'partial',
  'pending',
];

/**
 * Valid issue severities
 */
export const ISSUE_SEVERITIES = ['critical', 'major', 'minor'];

/**
 * Valid issue statuses
 */
export const ISSUE_STATUSES = ['identified', 'in_progress', 'resolved'];

/**
 * Valid test types
 */
export const TEST_TYPES = ['strength', 'quality', 'specification', 'compliance'];

/**
 * Valid test results
 */
export const TEST_RESULTS = ['pass', 'fail', 'conditional'];

/**
 * Valid document types
 */
export const DOCUMENT_TYPES = [
  'drawing',
  'specification',
  'report',
  'certificate',
  'approval',
  'photo',
  'invoice',
  'receipt',
  'contract',
  'other',
];





