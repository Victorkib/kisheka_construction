/**
 * Labour Data Parsing Helpers
 * Parse unstructured supervisor submissions into structured labour entries
 */

import { VALID_SKILL_TYPES } from './schemas/labour-entry-schema';

/**
 * Parse WhatsApp message format
 * Expected formats:
 * - "John Doe - Mason - 8hrs - 500/hr"
 * - "Worker Name, Skill, Hours, Rate"
 * - Line-by-line format
 * 
 * @param {string} text - WhatsApp message text
 * @returns {Array<Object>} Array of parsed labour entries
 */
export function parseWhatsAppMessage(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const entries = [];
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    // Try different patterns
    // Pattern 1: "Name - Skill - Hours - Rate"
    const pattern1 = /^(.+?)\s*-\s*(.+?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)?\s*-\s*(\d+(?:\.\d+)?)\s*(?:kes?|\/hr)?$/i;
    const match1 = line.match(pattern1);

    if (match1) {
      entries.push({
        workerName: match1[1].trim(),
        skillType: normalizeSkillType(match1[2].trim()),
        hours: parseFloat(match1[3]),
        hourlyRate: parseFloat(match1[4]),
        taskDescription: '',
      });
      continue;
    }

    // Pattern 2: "Name, Skill, Hours, Rate"
    const pattern2 = /^(.+?),\s*(.+?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)$/;
    const match2 = line.match(pattern2);

    if (match2) {
      entries.push({
        workerName: match2[1].trim(),
        skillType: normalizeSkillType(match2[2].trim()),
        hours: parseFloat(match2[3]),
        hourlyRate: parseFloat(match2[4]),
        taskDescription: '',
      });
      continue;
    }

    // Pattern 3: Simple format "Name Hours Rate"
    const pattern3 = /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/;
    const match3 = line.match(pattern3);

    if (match3) {
      entries.push({
        workerName: match3[1].trim(),
        skillType: 'general_worker', // Default
        hours: parseFloat(match3[2]),
        hourlyRate: parseFloat(match3[3]),
        taskDescription: '',
      });
      continue;
    }
  }

  return entries;
}

/**
 * Parse SMS message format (similar to WhatsApp)
 * @param {string} text - SMS message text
 * @returns {Array<Object>} Array of parsed labour entries
 */
export function parseSMSMessage(text) {
  // SMS format is typically shorter, use WhatsApp parser
  return parseWhatsAppMessage(text);
}

/**
 * Parse email content
 * Supports:
 * - Plain text body
 * - CSV attachments
 * - Excel attachments
 * 
 * @param {Object} email - Email object with body and attachments
 * @returns {Promise<Array<Object>>} Array of parsed labour entries
 */
export async function parseEmailContent(email) {
  const entries = [];

  // Parse email body
  if (email.body) {
    const bodyEntries = parseWhatsAppMessage(email.body);
    entries.push(...bodyEntries);
  }

  // Parse attachments if any
  if (email.attachments && Array.isArray(email.attachments)) {
    for (const attachment of email.attachments) {
      if (attachment.filename.endsWith('.csv')) {
        const csvEntries = await parseSpreadsheet(attachment.content, 'csv');
        entries.push(...csvEntries);
      } else if (attachment.filename.endsWith('.xlsx') || attachment.filename.endsWith('.xls')) {
        const excelEntries = await parseSpreadsheet(attachment.content, 'excel');
        entries.push(...excelEntries);
      }
    }
  }

  return entries;
}

/**
 * Parse spreadsheet (CSV or Excel)
 * Expected columns: Worker Name, Skill Type, Hours, Hourly Rate, [Task Description]
 * 
 * @param {string|Buffer} content - File content
 * @param {string} format - 'csv' | 'excel'
 * @returns {Promise<Array<Object>>} Array of parsed labour entries
 */
export async function parseSpreadsheet(content, format = 'csv') {
  const entries = [];

  try {
    if (format === 'csv') {
      // Parse CSV
      const lines = typeof content === 'string' ? content.split('\n') : content.toString().split('\n');
      
      // Skip header row if present
      let startIndex = 0;
      const firstLine = lines[0]?.toLowerCase() || '';
      if (firstLine.includes('name') || firstLine.includes('worker')) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = line.split(',').map((col) => col.trim());
        
        if (columns.length >= 4) {
          entries.push({
            workerName: columns[0] || '',
            skillType: normalizeSkillType(columns[1] || 'general_worker'),
            hours: parseFloat(columns[2]) || 0,
            hourlyRate: parseFloat(columns[3]) || 0,
            taskDescription: columns[4] || '',
          });
        }
      }
    } else if (format === 'excel') {
      // For Excel, we'd need a library like xlsx
      // For now, return empty array and note that Excel parsing requires additional dependency
      console.warn('Excel parsing requires xlsx library. Please install: npm install xlsx');
      // TODO: Implement Excel parsing with xlsx library
    }
  } catch (error) {
    console.error('Error parsing spreadsheet:', error);
    throw new Error(`Failed to parse spreadsheet: ${error.message}`);
  }

  return entries;
}

/**
 * Parse structured text format
 * More flexible parser for various text formats
 * 
 * @param {string} text - Structured text
 * @returns {Array<Object>} Array of parsed labour entries
 */
export function parseStructuredText(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const entries = [];
  
  // Try to detect format and parse accordingly
  // Check if it looks like a table
  if (text.includes('|') || text.includes('\t')) {
    // Table format
    const lines = text.split('\n').filter((line) => line.trim());
    const separator = text.includes('|') ? '|' : '\t';

    for (const line of lines) {
      const columns = line.split(separator).map((col) => col.trim()).filter(Boolean);
      
      if (columns.length >= 3) {
        entries.push({
          workerName: columns[0] || '',
          skillType: normalizeSkillType(columns[1] || 'general_worker'),
          hours: parseFloat(columns[2]) || 0,
          hourlyRate: parseFloat(columns[3]) || 0,
          taskDescription: columns[4] || '',
        });
      }
    }
  } else {
    // Try WhatsApp/SMS format
    return parseWhatsAppMessage(text);
  }

  return entries;
}

/**
 * Normalize skill type to match VALID_SKILL_TYPES
 * @param {string} skillType - Raw skill type string
 * @returns {string} Normalized skill type
 */
export function normalizeSkillType(skillType) {
  if (!skillType || typeof skillType !== 'string') {
    return 'general_worker';
  }

  const normalized = skillType.toLowerCase().trim().replace(/\s+/g, '_');

  // Direct match
  if (VALID_SKILL_TYPES.includes(normalized)) {
    return normalized;
  }

  // Fuzzy matching
  const skillMap = {
    mason: 'mason',
    bricklayer: 'mason',
    carpenter: 'carpenter',
    electrician: 'electrician',
    plumber: 'plumber',
    painter: 'painter',
    tile: 'tile_layer',
    tiler: 'tile_layer',
    architect: 'architect',
    engineer: 'engineer',
    structural: 'structural_engineer',
    mep: 'mep_engineer',
    surveyor: 'surveyor',
    supervisor: 'supervisor',
    foreman: 'foreman',
    helper: 'helper',
    general: 'general_worker',
    worker: 'general_worker',
  };

  for (const [key, value] of Object.entries(skillMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Default fallback
  return 'general_worker';
}

/**
 * Validate parsed data
 * @param {Array<Object>} parsedData - Parsed labour entries
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
export function validateParsedData(parsedData) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    errors.push('No labour entries found in parsed data');
    return { isValid: false, errors, warnings };
  }

  parsedData.forEach((entry, index) => {
    if (!entry.workerName || entry.workerName.trim().length < 2) {
      errors.push(`Entry ${index + 1}: workerName is required and must be at least 2 characters`);
    }

    if (!entry.skillType) {
      warnings.push(`Entry ${index + 1}: skillType not found, using default 'general_worker'`);
      entry.skillType = 'general_worker';
    }

    if (entry.hours === undefined || entry.hours === null || isNaN(entry.hours) || entry.hours <= 0) {
      errors.push(`Entry ${index + 1}: hours is required and must be > 0`);
    }

    if (entry.hourlyRate === undefined || entry.hourlyRate === null || isNaN(entry.hourlyRate) || entry.hourlyRate < 0) {
      errors.push(`Entry ${index + 1}: hourlyRate is required and must be >= 0`);
    }

    if (entry.hours > 24) {
      warnings.push(`Entry ${index + 1}: hours exceeds 24, please verify`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Match workers to existing profiles
 * @param {Array<string>} workerNames - Array of worker names
 * @param {Array<Object>} workerProfiles - Array of worker profiles
 * @returns {Object} Map of worker names to profile IDs
 */
export function matchWorkersToProfiles(workerNames, workerProfiles = []) {
  const matches = {};

  for (const workerName of workerNames) {
    const normalizedName = workerName.toLowerCase().trim();

    // Try exact match first
    let matched = workerProfiles.find(
      (profile) => profile.workerName.toLowerCase().trim() === normalizedName
    );

    // Try partial match
    if (!matched) {
      matched = workerProfiles.find((profile) => {
        const profileName = profile.workerName.toLowerCase().trim();
        return profileName.includes(normalizedName) || normalizedName.includes(profileName);
      });
    }

    if (matched) {
      matches[workerName] = {
        workerId: matched.userId || matched._id,
        workerName: matched.workerName,
        defaultHourlyRate: matched.defaultHourlyRate,
        skillTypes: matched.skillTypes,
      };
    }
  }

  return matches;
}

/**
 * Auto-fill missing data from worker profiles
 * @param {Array<Object>} entries - Labour entries
 * @param {Object} workerMap - Map of worker names to profiles
 * @returns {Array<Object>} Entries with auto-filled data
 */
export function autoFillFromProfiles(entries, workerMap) {
  return entries.map((entry) => {
    const workerInfo = workerMap[entry.workerName];

    if (workerInfo) {
      return {
        ...entry,
        workerId: workerInfo.workerId,
        hourlyRate: entry.hourlyRate || workerInfo.defaultHourlyRate || entry.hourlyRate,
        skillType: entry.skillType || workerInfo.skillTypes?.[0] || entry.skillType,
      };
    }

    return entry;
  });
}

export default {
  parseWhatsAppMessage,
  parseSMSMessage,
  parseEmailContent,
  parseSpreadsheet,
  parseStructuredText,
  normalizeSkillType,
  validateParsedData,
  matchWorkersToProfiles,
  autoFillFromProfiles,
};

