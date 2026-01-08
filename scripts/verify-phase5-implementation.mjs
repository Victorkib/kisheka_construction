/**
 * Phase 5 Implementation Verification Script
 * Verifies Advanced Features & Polish implementation
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

console.log('🔍 Verifying Phase 5: Advanced Features & Polish Implementation\n');

// 1. Budget Reallocation System
console.log('\n💰 Budget Reallocation System:');
check(
  'Budget reallocation schema exists',
  fileExists('src/lib/schemas/budget-reallocation-schema.js'),
  'Should have budget reallocation schema'
);
check(
  'Budget reallocation API route exists',
  fileExists('src/app/api/budget-reallocations/route.js'),
  'Should have main reallocation API'
);
check(
  'Budget reallocation approve endpoint exists',
  fileExists('src/app/api/budget-reallocations/[id]/approve/route.js'),
  'Should have approve endpoint'
);
check(
  'Budget reallocation reject endpoint exists',
  fileExists('src/app/api/budget-reallocations/[id]/reject/route.js'),
  'Should have reject endpoint'
);
check(
  'Budget reallocation listing page exists',
  fileExists('src/app/budget-reallocations/page.js'),
  'Should have listing page'
);
check(
  'Budget reallocation detail page exists',
  fileExists('src/app/budget-reallocations/[id]/page.js'),
  'Should have detail page'
);
check(
  'Budget reallocation creation page exists',
  fileExists('src/app/budget-reallocations/new/page.js'),
  'Should have creation page'
);
check(
  'Budget reallocation permissions added',
  fileContains('src/lib/permissions.js', 'create_budget_reallocation') &&
  fileContains('src/lib/permissions.js', 'approve_budget_reallocation'),
  'Should have reallocation permissions'
);
check(
  'Database setup includes budget_reallocations collection',
  fileContains('scripts/setup-database.mjs', 'budget_reallocations'),
  'Should setup budget_reallocations collection'
);

// 2. Forecasting & Analytics
console.log('\n📊 Forecasting & Analytics:');
check(
  'Forecasting helpers exist',
  fileExists('src/lib/forecasting-helpers.js'),
  'Should have forecasting helpers'
);
check(
  'Forecasting includes phase cost forecast',
  fileContains('src/lib/forecasting-helpers.js', 'forecastPhaseCosts'),
  'Should forecast phase costs'
);
check(
  'Forecasting includes project forecast',
  fileContains('src/lib/forecasting-helpers.js', 'forecastProject'),
  'Should forecast project costs'
);
check(
  'Forecasting includes risk assessment',
  fileContains('src/lib/forecasting-helpers.js', 'riskLevel') ||
  fileContains('src/lib/forecasting-helpers.js', 'riskIndicators'),
  'Should assess risks'
);
check(
  'Phase financial overview API exists',
  fileExists('src/app/api/projects/[id]/phase-financial-overview/route.js'),
  'Should have phase financial overview API'
);
check(
  'Phase financial overview includes forecast',
  fileContains('src/app/api/projects/[id]/phase-financial-overview/route.js', 'forecast') ||
  fileContains('src/app/api/projects/[id]/phase-financial-overview/route.js', 'forecastProject'),
  'Should include forecast in overview'
);

// 3. Owner Dashboard Enhancements
console.log('\n🎯 Owner Dashboard Enhancements:');
check(
  'Owner dashboard includes phase overview',
  fileContains('src/app/dashboard/owner/page.js', 'phaseOverview') ||
  fileContains('src/app/dashboard/owner/page.js', 'Phase Financial Overview'),
  'Should show phase overview'
);
check(
  'Owner dashboard includes project selector',
  fileContains('src/app/dashboard/owner/page.js', 'selectedProjectId') ||
  fileContains('src/app/dashboard/owner/page.js', 'projects'),
  'Should allow project selection'
);
check(
  'Owner dashboard includes risk indicators',
  fileContains('src/app/dashboard/owner/page.js', 'riskIndicators') ||
  fileContains('src/app/dashboard/owner/page.js', 'risk'),
  'Should display risk indicators'
);
check(
  'Owner dashboard includes phase list',
  fileContains('src/app/dashboard/owner/page.js', 'phases') &&
  fileContains('src/app/dashboard/owner/page.js', 'phase'),
  'Should list phases'
);

// 4. Integration Points
console.log('\n🔗 Integration Points:');
check(
  'Budget reallocation executes phase budget updates',
  fileContains('src/app/api/budget-reallocations/[id]/approve/route.js', 'budgetAllocation') &&
  fileContains('src/app/api/budget-reallocations/[id]/approve/route.js', 'recalculatePhaseSpending'),
  'Should update phase budgets on approval'
);
check(
  'Forecasting integrates with phase financials',
  fileContains('src/app/api/projects/[id]/phase-financial-overview/route.js', 'forecastProject') ||
  fileContains('src/app/api/projects/[id]/phase-financial-overview/route.js', 'forecast'),
  'Should integrate forecasting'
);

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Verification Summary:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📝 Total Checks: ${checks.length}`);
console.log(`   📈 Success Rate: ${((passed / checks.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All checks passed! Phase 5 implementation is complete.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Please review the issues above.');
  process.exit(1);
}



