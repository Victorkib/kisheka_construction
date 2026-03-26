/**
 * Professional Services Helpers
 *
 * Centralizes type labels and prefix mapping so UI/business logic doesn't hardcode
 * "architect vs engineer" everywhere.
 */

const TITLE_CASE_EXCEPTIONS = new Map([
  ['qs', 'QS'],
  ['mep', 'MEP'],
  ['hvac', 'HVAC'],
  ['nema', 'NEMA'],
  ['bq', 'BQ'],
]);

export function toTitleCase(input) {
  const raw = (input || '').toString().trim();
  if (!raw) return '';
  return raw
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (TITLE_CASE_EXCEPTIONS.has(lower)) return TITLE_CASE_EXCEPTIONS.get(lower);
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function getProfessionalTypeLabel(type) {
  if (!type) return 'Professional';
  if (type === 'architect') return 'Architect';
  if (type === 'engineer') return 'Engineer';
  return toTitleCase(type);
}

export function getProfessionalTypeCodePrefix(type) {
  switch ((type || '').toString()) {
    case 'architect':
      return 'ARCH';
    case 'engineer':
      return 'ENG';
    case 'quantity_surveyor':
      return 'QS';
    case 'land_surveyor':
      return 'SURV';
    case 'interior_designer':
      return 'INT';
    case 'project_manager':
      return 'PM';
    case 'nema_consultant':
      return 'NEMA';
    case 'geotechnical_engineer':
      return 'GEO';
    case 'mep_engineer':
      return 'MEP';
    case 'fire_safety_consultant':
      return 'FIRE';
    default:
      return 'PRO';
  }
}

export default {
  toTitleCase,
  getProfessionalTypeLabel,
  getProfessionalTypeCodePrefix,
};

