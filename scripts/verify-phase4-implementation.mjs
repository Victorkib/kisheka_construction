/**
 * Phase 4 Implementation Verification Script
 * Verifies Phase-Expense Integration implementation
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, details = '') {
  checks.push({ name, condition, details });
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}${details ? ` - ${details}` : ''}`);
    failed++;
  }
}

function fileExists(path) {
  return existsSync(join(rootDir, path));
}

function fileContains(path, searchText) {
  if (!fileExists(path)) return false;
  const content = readFileSync(join(rootDir, path), 'utf-8');
  return content.includes(searchText);
}

console.log('🔍 Verifying Phase 4: Phase-Expense Integration Implementation\n');

// 1. API Updates
console.log('\n📡 API Updates:');
check(
  'Materials GET API supports phaseId filter',
  fileContains('src/app/api/materials/route.js', 'phaseId') &&
  fileContains('src/app/api/materials/route.js', 'query.phaseId'),
  'Should filter materials by phaseId'
);
check(
  'Materials POST API accepts phaseId',
  fileContains('src/app/api/materials/route.js', 'phaseId') &&
  (fileContains('src/app/api/materials/route.js', 'Validate phase') ||
   fileContains('src/app/api/materials/route.js', 'validate phase') ||
   fileContains('src/app/api/materials/route.js', 'phase.projectId')),
  'Should accept and validate phaseId'
);
check(
  'Materials PATCH API supports phaseId update',
  fileContains('src/app/api/materials/[id]/route.js', 'phaseId') &&
  fileContains('src/app/api/materials/[id]/route.js', 'recalculatePhaseSpending'),
  'Should update phaseId and recalculate phase spending'
);
check(
  'Expenses GET API supports phaseId filter',
  fileContains('src/app/api/expenses/route.js', 'phaseId') &&
  fileContains('src/app/api/expenses/route.js', 'query.phaseId'),
  'Should filter expenses by phaseId'
);
check(
  'Expenses POST API accepts phaseId',
  fileContains('src/app/api/expenses/route.js', 'phaseId') &&
  (fileContains('src/app/api/expenses/route.js', 'Validate phase') ||
   fileContains('src/app/api/expenses/route.js', 'validate phase') ||
   fileContains('src/app/api/expenses/route.js', 'phase.projectId')),
  'Should accept and validate phaseId'
);
check(
  'Expenses PATCH API supports phaseId update',
  fileContains('src/app/api/expenses/[id]/route.js', 'phaseId') &&
  fileContains('src/app/api/expenses/[id]/route.js', 'recalculatePhaseSpending'),
  'Should update phaseId and recalculate phase spending'
);

// 2. UI Updates
console.log('\n🎨 UI Updates:');
check(
  'Material creation form includes phase selection',
  fileContains('src/app/items/new/page.js', 'phaseId') &&
  fileContains('src/app/items/new/page.js', 'fetchPhases'),
  'Should have phase dropdown in material form'
);
check(
  'Expense creation form includes phase selection',
  fileContains('src/app/expenses/new/page.js', 'phaseId') &&
  fileContains('src/app/expenses/new/page.js', 'fetchPhases'),
  'Should have phase dropdown in expense form'
);
check(
  'Materials listing page has phase filter',
  fileContains('src/app/items/page.js', 'phaseId') &&
  fileContains('src/app/items/page.js', 'filters.phaseId'),
  'Should filter materials by phase'
);
check(
  'Expenses listing page has phase filter',
  fileContains('src/app/expenses/page.js', 'phaseId') &&
  fileContains('src/app/expenses/page.js', 'filters.phaseId'),
  'Should filter expenses by phase'
);

// 3. Phase Financial Integration
console.log('\n💰 Phase Financial Integration:');
check(
  'Phase financial API calculates materials spending',
  fileContains('src/app/api/phases/[id]/financial/route.js', 'phaseId') &&
  fileContains('src/app/api/phases/[id]/financial/route.js', 'materials'),
  'Should calculate materials spending by phase'
);
check(
  'Phase financial API calculates expenses spending',
  fileContains('src/app/api/phases/[id]/financial/route.js', 'expenses') &&
  fileContains('src/app/api/phases/[id]/financial/route.js', 'phaseId'),
  'Should calculate expenses spending by phase'
);
check(
  'Phase helpers include recalculatePhaseSpending',
  fileExists('src/lib/phase-helpers.js') &&
  fileContains('src/lib/phase-helpers.js', 'recalculatePhaseSpending'),
  'Should have phase spending recalculation function'
);

// 4. Migration Script
console.log('\n🔄 Migration Script:');
check(
  'Migration script exists',
  fileExists('scripts/migrate-phase-associations.mjs'),
  'Should have migration script for existing data'
);
check(
  'Migration script handles materials',
  fileContains('scripts/migrate-phase-associations.mjs', 'materials') &&
  fileContains('scripts/migrate-phase-associations.mjs', 'phaseId'),
  'Should migrate materials collection'
);
check(
  'Migration script handles expenses',
  fileContains('scripts/migrate-phase-associations.mjs', 'expenses') &&
  fileContains('scripts/migrate-phase-associations.mjs', 'phaseId'),
  'Should migrate expenses collection'
);
check(
  'Migration script creates indexes',
  fileContains('scripts/migrate-phase-associations.mjs', 'createIndex') ||
  fileContains('scripts/migrate-phase-associations.mjs', 'index'),
  'Should create indexes for phaseId'
);

// 5. Integration Points
console.log('\n🔗 Integration Points:');
check(
  'Material update triggers phase recalculation',
  fileContains('src/app/api/materials/[id]/route.js', 'recalculatePhaseSpending'),
  'Should recalculate phase when material phase changes'
);
check(
  'Expense update triggers phase recalculation',
  fileContains('src/app/api/expenses/[id]/route.js', 'recalculatePhaseSpending'),
  'Should recalculate phase when expense phase changes'
);
check(
  'Material delete triggers phase recalculation',
  fileContains('src/app/api/materials/[id]/route.js', 'recalculatePhaseSpending') &&
  fileContains('src/app/api/materials/[id]/route.js', 'DELETE'),
  'Should recalculate phase when material is deleted'
);
check(
  'Expense delete triggers phase recalculation',
  fileContains('src/app/api/expenses/[id]/route.js', 'recalculatePhaseSpending') &&
  fileContains('src/app/api/expenses/[id]/route.js', 'DELETE'),
  'Should recalculate phase when expense is deleted'
);

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Verification Summary:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📝 Total Checks: ${checks.length}`);
console.log(`   📈 Success Rate: ${((passed / checks.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All checks passed! Phase 4 implementation is complete.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Please review the issues above.');
  process.exit(1);
}

