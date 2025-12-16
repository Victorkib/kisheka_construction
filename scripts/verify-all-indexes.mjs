/**
 * Verify All Index Fixes
 * 
 * This script verifies that all indexes are correctly configured
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'kisheka_prod';

async function verifyAllIndexes() {
  let client;
  
  try {
    console.log('🔍 Verifying All Index Fixes\n');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    
    const verification = {
      phase1: { passed: [], failed: [] },
      phase2: { passed: [], failed: [] },
      phase3: { passed: [], failed: [] },
    };
    
    // Phase 1: Critical Fixes
    console.log('='.repeat(80));
    console.log('PHASE 1: CRITICAL FIXES VERIFICATION');
    console.log('='.repeat(80));
    
    // 1.1 Materials Index
    console.log('\n📋 Materials Index:');
    const materialsCollection = db.collection('materials');
    const materialsIndexes = await materialsCollection.indexes();
    const materialsPartialIndex = materialsIndexes.find(idx => 
      idx.name === 'project_materialCode_unique_partial'
    );
    
    if (materialsPartialIndex) {
      console.log('   ✅ Partial index exists');
      console.log(`   Name: ${materialsPartialIndex.name}`);
      console.log(`   Unique: ${materialsPartialIndex.unique}`);
      console.log(`   Partial Filter: ${JSON.stringify(materialsPartialIndex.partialFilterExpression)}`);
      verification.phase1.passed.push('Materials partial index');
    } else {
      console.log('   ❌ Partial index not found');
      verification.phase1.failed.push('Materials partial index missing');
    }
    
    // 1.2 Expenses Index
    console.log('\n📋 Expenses Index:');
    const expensesCollection = db.collection('expenses');
    const expensesIndexes = await expensesCollection.indexes();
    const expensesSparseIndex = expensesIndexes.find(idx => 
      idx.name === 'project_expenseCode_unique_sparse'
    );
    
    if (expensesSparseIndex) {
      console.log('   ✅ Sparse index exists');
      console.log(`   Name: ${expensesSparseIndex.name}`);
      console.log(`   Unique: ${expensesSparseIndex.unique}`);
      console.log(`   Sparse: ${expensesSparseIndex.sparse}`);
      verification.phase1.passed.push('Expenses sparse index');
    } else {
      console.log('   ❌ Sparse index not found');
      verification.phase1.failed.push('Expenses sparse index missing');
    }
    
    // Phase 2: Important Fixes
    console.log('\n\n' + '='.repeat(80));
    console.log('PHASE 2: IMPORTANT FIXES VERIFICATION');
    console.log('='.repeat(80));
    
    // 2.1 Floors Index
    console.log('\n📋 Floors Index:');
    const floorsCollection = db.collection('floors');
    const floorsIndexes = await floorsCollection.indexes();
    const floorsUniqueIndex = floorsIndexes.find(idx => 
      idx.name === 'project_floorNumber_unique'
    );
    
    if (floorsUniqueIndex) {
      console.log('   ✅ Unique index exists');
      console.log(`   Name: ${floorsUniqueIndex.name}`);
      console.log(`   Unique: ${floorsUniqueIndex.unique}`);
      verification.phase2.passed.push('Floors unique index');
    } else {
      console.log('   ❌ Unique index not found');
      verification.phase2.failed.push('Floors unique index missing');
    }
    
    // 2.2 Initial Expenses Index
    console.log('\n📋 Initial Expenses Index:');
    const initialExpensesCollection = db.collection('initial_expenses');
    const initialExpensesIndexes = await initialExpensesCollection.indexes();
    const initialExpensesSparseIndex = initialExpensesIndexes.find(idx => 
      idx.name === 'project_expenseCode_unique_sparse'
    );
    
    if (initialExpensesSparseIndex) {
      console.log('   ✅ Sparse unique index exists');
      console.log(`   Name: ${initialExpensesSparseIndex.name}`);
      console.log(`   Unique: ${initialExpensesSparseIndex.unique}`);
      console.log(`   Sparse: ${initialExpensesSparseIndex.sparse}`);
      verification.phase2.passed.push('Initial expenses sparse index');
    } else {
      console.log('   ❌ Sparse index not found');
      verification.phase2.failed.push('Initial expenses sparse index missing');
    }
    
    // 2.3 Categories Index
    console.log('\n📋 Categories Index:');
    const categoriesCollection = db.collection('categories');
    const categoriesIndexes = await categoriesCollection.indexes();
    const categoriesUniqueIndex = categoriesIndexes.find(idx => 
      idx.name === 'name_unique'
    );
    
    if (categoriesUniqueIndex) {
      console.log('   ✅ Unique index exists');
      console.log(`   Name: ${categoriesUniqueIndex.name}`);
      console.log(`   Unique: ${categoriesUniqueIndex.unique}`);
      verification.phase2.passed.push('Categories unique index');
    } else {
      console.log('   ❌ Unique index not found');
      verification.phase2.failed.push('Categories unique index missing');
    }
    
    // Phase 3: Performance Indexes
    console.log('\n\n' + '='.repeat(80));
    console.log('PHASE 3: PERFORMANCE INDEXES VERIFICATION');
    console.log('='.repeat(80));
    
    const performanceIndexes = {
      materials: ['projectId_createdAt_desc', 'supplierName_idx', 'categoryId_idx'],
      expenses: ['projectId_createdAt_desc', 'vendor_idx'],
      initial_expenses: ['projectId_createdAt_desc', 'status_idx', 'enteredBy_idx'],
      floors: ['project_status_idx', 'projectId_createdAt_desc'],
      investors: ['userId_idx', 'status_idx', 'email_idx'],
      project_finances: ['projectId_unique', 'lastUpdated_desc'],
    };
    
    for (const [collectionName, expectedIndexes] of Object.entries(performanceIndexes)) {
      console.log(`\n📋 ${collectionName}:`);
      const collection = db.collection(collectionName);
      const indexes = await collection.indexes();
      const indexNames = indexes.map(idx => idx.name);
      
      for (const expectedIndex of expectedIndexes) {
        if (indexNames.includes(expectedIndex)) {
          console.log(`   ✅ ${expectedIndex}`);
          verification.phase3.passed.push(`${collectionName}: ${expectedIndex}`);
        } else {
          console.log(`   ❌ ${expectedIndex} missing`);
          verification.phase3.failed.push(`${collectionName}: ${expectedIndex}`);
        }
      }
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    
    const totalPassed = verification.phase1.passed.length + 
                        verification.phase2.passed.length + 
                        verification.phase3.passed.length;
    const totalFailed = verification.phase1.failed.length + 
                       verification.phase2.failed.length + 
                       verification.phase3.failed.length;
    
    console.log(`\n✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 All verifications passed!');
    } else {
      console.log('\n⚠️  Some verifications failed:');
      if (verification.phase1.failed.length > 0) {
        console.log('\n  Phase 1:');
        verification.phase1.failed.forEach(f => console.log(`    - ${f}`));
      }
      if (verification.phase2.failed.length > 0) {
        console.log('\n  Phase 2:');
        verification.phase2.failed.forEach(f => console.log(`    - ${f}`));
      }
      if (verification.phase3.failed.length > 0) {
        console.log('\n  Phase 3:');
        verification.phase3.failed.forEach(f => console.log(`    - ${f}`));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

verifyAllIndexes()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

