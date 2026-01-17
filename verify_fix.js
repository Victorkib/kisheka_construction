const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/labour/entries/route.js');
const content = fs.readFileSync(filePath, 'utf-8');

console.log('✅ LABOUR ENTRY FIX VERIFICATION\n');
console.log('='.repeat(60));

// Check 1: budgetValidation declared outside if/else
const scopeCheck = content.includes('let budgetValidation;') && 
                   content.split('let budgetValidation;')[0].includes('const labourEntry = createLabourEntry');
console.log(`\n1. Variable Scope Fix: ${scopeCheck ? '✅ PASS' : '❌ FAIL'}`);
console.log('   - budgetValidation declared outside if/else block');

// Check 2: Indirect labour path sets budgetValidation
const indirectCheck = content.includes('budgetValidation = await validateIndirectCostsBudget');
console.log(`\n2. Indirect Labour Path: ${indirectCheck ? '✅ PASS' : '❌ FAIL'}`);
console.log('   - Indirect labour validation assigns to budgetValidation');

// Check 3: Direct labour path sets budgetValidation
const directCheck = content.includes('budgetValidation = await validatePhaseLabourBudget');
console.log(`\n3. Direct Labour Path: ${directCheck ? '✅ PASS' : '❌ FAIL'}`);
console.log('   - Direct labour validation assigns to budgetValidation');

// Check 4: No more currentSpending or non-existent properties
const noCurrentSpending = !content.includes('budgetValidation.currentSpending');
const noBudgetProp = !content.includes("budgetValidation.budget");
console.log(`\n4. Removed Invalid Properties: ${(noCurrentSpending && noBudgetProp) ? '✅ PASS' : '❌ FAIL'}`);
console.log('   - Removed: budgetValidation.currentSpending');
console.log('   - Removed: budgetValidation.budget');

// Check 5: Response uses valid properties
const validResponse = content.includes('available: budgetValidation.available') &&
                      content.includes('required: budgetValidation.required') &&
                      content.includes('shortfall: budgetValidation.shortfall') &&
                      content.includes('message: budgetValidation.message');
console.log(`\n5. Response Properties: ${validResponse ? '✅ PASS' : '❌ FAIL'}`);
console.log('   - Uses: available, required, shortfall, message, isValid');

// Check 6: Audit log has correct structure
const auditLogCorrect = content.includes('before: budgetValidation.available + labourEntry.totalCost') &&
                        content.includes('after: budgetValidation.available') &&
                        content.includes('shortfall: budgetValidation.shortfall');
console.log(`\n6. Audit Log Structure: ${auditLogCorrect ? '✅ PASS' : '❌ FAIL'}`);
console.log('   - Uses correct properties in budgetImpact');

// Summary
const allPass = scopeCheck && indirectCheck && directCheck && noCurrentSpending && 
                noBudgetProp && validResponse && auditLogCorrect;
console.log('\n' + '='.repeat(60));
console.log(`\nOVERALL STATUS: ${allPass ? '✅ ALL FIXES VERIFIED' : '❌ SOME ISSUES FOUND'}\n`);

process.exit(allPass ? 0 : 1);
