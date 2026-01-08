/**
 * Phase 3 Implementation Verification Script
 * Verifies Enhanced Budget Structure implementation
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

console.log('🔍 Verifying Phase 3: Enhanced Budget Structure Implementation\n');

// 1. Component Files
console.log('\n📦 Component Files:');
check(
  'EnhancedBudgetInput component exists',
  fileExists('src/components/budget/EnhancedBudgetInput.js'),
  'Should be at src/components/budget/EnhancedBudgetInput.js'
);
check(
  'HierarchicalBudgetDisplay component exists',
  fileExists('src/components/budget/HierarchicalBudgetDisplay.js'),
  'Should be at src/components/budget/HierarchicalBudgetDisplay.js'
);
check(
  'BudgetVisualization component exists',
  fileExists('src/components/budget/BudgetVisualization.js'),
  'Should be at src/components/budget/BudgetVisualization.js'
);

// 2. Component Functionality
console.log('\n🔧 Component Functionality:');
check(
  'EnhancedBudgetInput supports legacy mode',
  fileContains('src/components/budget/EnhancedBudgetInput.js', 'Legacy mode'),
  'Should support legacy budget structure'
);
check(
  'EnhancedBudgetInput supports enhanced mode',
  fileContains('src/components/budget/EnhancedBudgetInput.js', 'Enhanced mode'),
  'Should support enhanced budget structure'
);
check(
  'HierarchicalBudgetDisplay handles both structures',
  fileContains('src/components/budget/HierarchicalBudgetDisplay.js', 'isEnhancedBudget'),
  'Should detect and handle both budget structures'
);
check(
  'BudgetVisualization includes charts',
  fileContains('src/components/budget/BudgetVisualization.js', 'PieChart'),
  'Should include pie chart visualization'
);
check(
  'BudgetVisualization includes variance analysis',
  fileContains('src/components/budget/BudgetVisualization.js', 'variance'),
  'Should include variance analysis'
);

// 3. Integration Points
console.log('\n🔗 Integration Points:');
check(
  'Project creation page uses EnhancedBudgetInput',
  fileContains('src/app/projects/new/page.js', 'EnhancedBudgetInput'),
  'Should import and use EnhancedBudgetInput'
);
check(
  'Project detail page uses HierarchicalBudgetDisplay',
  fileContains('src/app/projects/[id]/page.js', 'HierarchicalBudgetDisplay'),
  'Should import and use HierarchicalBudgetDisplay'
);
check(
  'Project detail page uses BudgetVisualization',
  fileContains('src/app/projects/[id]/page.js', 'BudgetVisualization'),
  'Should import and use BudgetVisualization'
);
check(
  'Project edit modal uses EnhancedBudgetInput',
  fileContains('src/app/projects/[id]/page.js', 'EnhancedBudgetInput'),
  'Edit modal should use EnhancedBudgetInput'
);
check(
  'Budget dashboard uses new components',
  fileContains('src/app/dashboard/budget/page.js', 'HierarchicalBudgetDisplay') ||
  fileContains('src/app/dashboard/budget/page.js', 'BudgetVisualization'),
  'Should use new budget components'
);

// 4. Budget Schema Usage
console.log('\n📊 Budget Schema Usage:');
check(
  'Components import budget schema helpers',
  fileContains('src/components/budget/EnhancedBudgetInput.js', 'budget-schema') ||
  fileContains('src/components/budget/HierarchicalBudgetDisplay.js', 'budget-schema') ||
  fileContains('src/components/budget/BudgetVisualization.js', 'budget-schema'),
  'Should import budget schema helpers'
);
check(
  'Budget schema helpers are used correctly',
  fileContains('src/components/budget/HierarchicalBudgetDisplay.js', 'getBudgetTotal') ||
  fileContains('src/components/budget/HierarchicalBudgetDisplay.js', 'getMaterialsBudget'),
  'Should use budget schema helper functions'
);

// 5. Validation and Error Handling
console.log('\n✅ Validation and Error Handling:');
check(
  'EnhancedBudgetInput has validation',
  fileContains('src/components/budget/EnhancedBudgetInput.js', 'min="0"') ||
  fileContains('src/components/budget/EnhancedBudgetInput.js', 'validation'),
  'Should include input validation'
);
check(
  'Project detail page validates budget changes',
  fileContains('src/app/projects/[id]/page.js', 'validateForm') &&
  fileContains('src/app/projects/[id]/page.js', 'budget'),
  'Should validate budget in edit form'
);

// 6. Backward Compatibility
console.log('\n🔄 Backward Compatibility:');
check(
  'Components handle legacy budgets',
  fileContains('src/components/budget/EnhancedBudgetInput.js', 'legacy') ||
  fileContains('src/components/budget/HierarchicalBudgetDisplay.js', 'legacy'),
  'Should handle legacy budget structure'
);
check(
  'Project creation supports both structures',
  fileContains('src/app/projects/new/page.js', 'budget') &&
  fileContains('src/app/projects/new/page.js', 'EnhancedBudgetInput'),
  'Should support both budget structures'
);

// 7. Financial Calculations
console.log('\n💰 Financial Calculations:');
check(
  'Financial helpers use budget schema',
  fileExists('src/lib/financial-helpers.js') &&
  fileContains('src/lib/financial-helpers.js', 'budget-schema'),
  'Should use budget schema helpers'
);
check(
  'Financial overview supports enhanced budget',
  fileContains('src/lib/financial-helpers.js', 'isEnhancedBudget') ||
  fileContains('src/lib/financial-helpers.js', 'getBudgetTotal'),
  'Should support enhanced budget structure'
);

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Verification Summary:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📝 Total Checks: ${checks.length}`);
console.log(`   📈 Success Rate: ${((passed / checks.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All checks passed! Phase 3 implementation is complete.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Please review the issues above.');
  process.exit(1);
}



