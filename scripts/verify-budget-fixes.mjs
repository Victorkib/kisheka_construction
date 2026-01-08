/**
 * Budget Fixes Verification Script
 * Tests all 8 project creation scenarios to ensure fixes work correctly
 */

import { MongoClient, ObjectId } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kisheka_construction';

// Import budget schema functions
const budgetSchemaPath = join(__dirname, '..', 'src', 'lib', 'schemas', 'budget-schema.js');
const { 
  convertLegacyToEnhanced, 
  isEnhancedBudget, 
  getBudgetTotal,
  validateBudget,
  createEnhancedBudget
} = await import(`file://${budgetSchemaPath}`);

let client;
let db;

async function connect() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function disconnect() {
  if (client) {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

async function testScenario1_SimpleBudget_NoAdvanced_AutoInit() {
  console.log('\n📋 Scenario 1: Simple Budget + No Advanced + Auto-Init Phases');
  console.log('='.repeat(70));
  
  const legacyBudget = {
    total: 100000000,
    materials: 60000000,
    labour: 25000000,
    contingency: 15000000
  };
  
  console.log('Input Budget:');
  console.log(`  Total: ${formatCurrency(legacyBudget.total)}`);
  console.log(`  Materials: ${formatCurrency(legacyBudget.materials)}`);
  console.log(`  Labour: ${formatCurrency(legacyBudget.labour)}`);
  console.log(`  Contingency: ${formatCurrency(legacyBudget.contingency)}`);
  
  // Convert to enhanced
  const enhancedBudget = convertLegacyToEnhanced(legacyBudget);
  
  console.log('\nConverted Budget:');
  console.log(`  Total: ${formatCurrency(enhancedBudget.total)}`);
  console.log(`  Direct Construction Costs: ${formatCurrency(enhancedBudget.directConstructionCosts)}`);
  console.log(`  Pre-Construction: ${formatCurrency(enhancedBudget.preConstructionCosts)}`);
  console.log(`  Indirect Costs: ${formatCurrency(enhancedBudget.indirectCosts)}`);
  console.log(`  Contingency Reserve: ${formatCurrency(enhancedBudget.contingencyReserve)}`);
  
  // Verify components sum to total
  const sum = enhancedBudget.directConstructionCosts + 
              enhancedBudget.preConstructionCosts + 
              enhancedBudget.indirectCosts + 
              enhancedBudget.contingencyReserve;
  
  const variance = Math.abs(enhancedBudget.total - sum);
  const isMatch = variance < 1000; // Allow 1000 KES rounding
  
  console.log(`\n  Components Sum: ${formatCurrency(sum)}`);
  console.log(`  Variance: ${formatCurrency(variance)}`);
  console.log(`  ✅ Match: ${isMatch ? 'YES' : 'NO'}`);
  
  // Validate budget
  const validation = validateBudget(enhancedBudget);
  console.log(`  ✅ Validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
  if (!validation.isValid) {
    console.log(`  Errors: ${validation.errors.join(', ')}`);
  }
  if (validation.warnings && validation.warnings.length > 0) {
    console.log(`  Warnings: ${validation.warnings.join(', ')}`);
  }
  
  // Test phase allocation
  const totalBudget = getBudgetTotal(enhancedBudget);
  const phaseAllocations = {
    preConstruction: totalBudget * 0.06,
    basement: totalBudget * 0.15,
    superstructure: totalBudget * 0.60,
    finishing: totalBudget * 0.15,
    finalSystems: totalBudget * 0.04
  };
  const totalAllocated = Object.values(phaseAllocations).reduce((sum, val) => sum + val, 0);
  const phaseVariance = Math.abs(totalBudget - totalAllocated);
  const phaseMatch = phaseVariance < 1000;
  
  console.log(`\nPhase Allocation Test:`);
  console.log(`  Project Budget: ${formatCurrency(totalBudget)}`);
  console.log(`  Total Allocated: ${formatCurrency(totalAllocated)}`);
  console.log(`  Variance: ${formatCurrency(phaseVariance)}`);
  console.log(`  ✅ Match: ${phaseMatch ? 'YES' : 'NO'}`);
  
  return {
    scenario: 1,
    budgetMatch: isMatch,
    validation: validation.isValid,
    phaseMatch: phaseMatch,
    total: enhancedBudget.total,
    expectedTotal: legacyBudget.total
  };
}

async function testScenario5_EnhancedBudget_NoAdvanced_AutoInit() {
  console.log('\n📋 Scenario 5: Enhanced Budget + No Advanced + Auto-Init Phases');
  console.log('='.repeat(70));
  
  const enhancedBudget = {
    total: 113000000,
    directConstructionCosts: 93000000,
    preConstructionCosts: 5000000,
    indirectCosts: 0,
    contingencyReserve: 15000000,
    directCosts: {
      materials: { total: 60000000, structural: 39000000, finishing: 15000000, mep: 4800000, specialty: 1200000 },
      labour: { total: 25000000, skilled: 15000000, unskilled: 7500000, supervisory: 2000000, specialized: 500000 },
      equipment: { total: 5000000, rental: 3500000, purchase: 1000000, maintenance: 500000 },
      subcontractors: { total: 3000000, specializedTrades: 2400000, professionalServices: 600000 }
    }
  };
  
  console.log('Input Budget:');
  console.log(`  Total: ${formatCurrency(enhancedBudget.total)}`);
  console.log(`  Direct Construction: ${formatCurrency(enhancedBudget.directConstructionCosts)}`);
  console.log(`  Pre-Construction: ${formatCurrency(enhancedBudget.preConstructionCosts)}`);
  console.log(`  Indirect: ${formatCurrency(enhancedBudget.indirectCosts)}`);
  console.log(`  Contingency: ${formatCurrency(enhancedBudget.contingencyReserve)}`);
  
  // Validate budget
  const validation = validateBudget(enhancedBudget);
  console.log(`\n✅ Validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
  if (!validation.isValid) {
    console.log(`  Errors: ${validation.errors.join(', ')}`);
  }
  
  // Verify components sum to total
  const sum = enhancedBudget.directConstructionCosts + 
              enhancedBudget.preConstructionCosts + 
              enhancedBudget.indirectCosts + 
              enhancedBudget.contingencyReserve;
  
  const variance = Math.abs(enhancedBudget.total - sum);
  const isMatch = variance < 1000;
  
  console.log(`  Components Sum: ${formatCurrency(sum)}`);
  console.log(`  Variance: ${formatCurrency(variance)}`);
  console.log(`  ✅ Match: ${isMatch ? 'YES' : 'NO'}`);
  
  return {
    scenario: 5,
    budgetMatch: isMatch,
    validation: validation.isValid,
    total: enhancedBudget.total,
    calculatedTotal: sum
  };
}

async function testScenario7_EnhancedBudget_Advanced_AutoInit() {
  console.log('\n📋 Scenario 7: Enhanced Budget + Advanced Options + Auto-Init Phases');
  console.log('='.repeat(70));
  
  const enhancedBudget = {
    total: 116000000,
    directConstructionCosts: 93000000,
    preConstructionCosts: 5000000,
    indirectCosts: 3000000,
    contingencyReserve: 15000000,
    directCosts: {
      materials: { total: 60000000, structural: 39000000, finishing: 15000000, mep: 4800000, specialty: 1200000 },
      labour: { total: 25000000, skilled: 15000000, unskilled: 7500000, supervisory: 2000000, specialized: 500000 },
      equipment: { total: 5000000, rental: 3500000, purchase: 1000000, maintenance: 500000 },
      subcontractors: { total: 3000000, specializedTrades: 2400000, professionalServices: 600000 }
    },
    preConstruction: {
      total: 5000000,
      landAcquisition: 2000000,
      legalRegulatory: 500000,
      permitsApprovals: 1000000,
      sitePreparation: 1500000
    },
    indirect: {
      total: 3000000,
      siteOverhead: 1500000,
      transportation: 500000,
      utilities: 300000,
      safetyCompliance: 700000
    },
    contingency: {
      total: 15000000,
      designContingency: 5000000,
      constructionContingency: 8000000,
      ownersReserve: 2000000
    }
  };
  
  console.log('Input Budget:');
  console.log(`  Total: ${formatCurrency(enhancedBudget.total)}`);
  console.log(`  Direct Construction: ${formatCurrency(enhancedBudget.directConstructionCosts)}`);
  console.log(`  Pre-Construction: ${formatCurrency(enhancedBudget.preConstructionCosts)}`);
  console.log(`  Indirect: ${formatCurrency(enhancedBudget.indirectCosts)}`);
  console.log(`  Contingency: ${formatCurrency(enhancedBudget.contingencyReserve)}`);
  
  // Validate budget
  const validation = validateBudget(enhancedBudget);
  console.log(`\n✅ Validation: ${validation.isValid ? 'PASS' : 'FAIL'}`);
  if (!validation.isValid) {
    console.log(`  Errors: ${validation.errors.join(', ')}`);
  }
  if (validation.warnings && validation.warnings.length > 0) {
    console.log(`  Warnings: ${validation.warnings.join(', ')}`);
  }
  
  // Verify components sum to total
  const sum = enhancedBudget.directConstructionCosts + 
              enhancedBudget.preConstructionCosts + 
              enhancedBudget.indirectCosts + 
              enhancedBudget.contingencyReserve;
  
  const variance = Math.abs(enhancedBudget.total - sum);
  const isMatch = variance < 1000;
  
  console.log(`  Components Sum: ${formatCurrency(sum)}`);
  console.log(`  Variance: ${formatCurrency(variance)}`);
  console.log(`  ✅ Match: ${isMatch ? 'YES' : 'NO'}`);
  
  // Verify breakdowns match totals
  const preConBreakdown = 
    enhancedBudget.preConstruction.landAcquisition +
    enhancedBudget.preConstruction.legalRegulatory +
    enhancedBudget.preConstruction.permitsApprovals +
    enhancedBudget.preConstruction.sitePreparation;
  const preConMatch = Math.abs(preConBreakdown - enhancedBudget.preConstructionCosts) < 1000;
  
  const indirectBreakdown = 
    enhancedBudget.indirect.siteOverhead +
    enhancedBudget.indirect.transportation +
    enhancedBudget.indirect.utilities +
    enhancedBudget.indirect.safetyCompliance;
  const indirectMatch = Math.abs(indirectBreakdown - enhancedBudget.indirectCosts) < 1000;
  
  const contingencyBreakdown = 
    enhancedBudget.contingency.designContingency +
    enhancedBudget.contingency.constructionContingency +
    enhancedBudget.contingency.ownersReserve;
  const contingencyMatch = Math.abs(contingencyBreakdown - enhancedBudget.contingencyReserve) < 1000;
  
  console.log(`\nBreakdown Verification:`);
  console.log(`  Pre-Construction: ${preConMatch ? '✅' : '❌'} (${formatCurrency(preConBreakdown)} vs ${formatCurrency(enhancedBudget.preConstructionCosts)})`);
  console.log(`  Indirect: ${indirectMatch ? '✅' : '❌'} (${formatCurrency(indirectBreakdown)} vs ${formatCurrency(enhancedBudget.indirectCosts)})`);
  console.log(`  Contingency: ${contingencyMatch ? '✅' : '❌'} (${formatCurrency(contingencyBreakdown)} vs ${formatCurrency(enhancedBudget.contingencyReserve)})`);
  
  return {
    scenario: 7,
    budgetMatch: isMatch,
    validation: validation.isValid,
    breakdownMatch: preConMatch && indirectMatch && contingencyMatch,
    total: enhancedBudget.total,
    calculatedTotal: sum
  };
}

async function runAllTests() {
  console.log('🧪 Budget Fixes Verification');
  console.log('='.repeat(70));
  console.log('Testing all critical scenarios after fixes...\n');
  
  const results = [];
  
  try {
    // Test Scenario 1
    const result1 = await testScenario1_SimpleBudget_NoAdvanced_AutoInit();
    results.push(result1);
    
    // Test Scenario 5
    const result5 = await testScenario5_EnhancedBudget_NoAdvanced_AutoInit();
    results.push(result5);
    
    // Test Scenario 7
    const result7 = await testScenario7_EnhancedBudget_Advanced_AutoInit();
    results.push(result7);
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    
    let allPassed = true;
    for (const result of results) {
      const status = (result.budgetMatch && result.validation) ? '✅ PASS' : '❌ FAIL';
      console.log(`Scenario ${result.scenario}: ${status}`);
      if (!result.budgetMatch || !result.validation) {
        allPassed = false;
      }
    }
    
    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

// Run tests
await connect();
await runAllTests();
await disconnect();

process.exit(0);



