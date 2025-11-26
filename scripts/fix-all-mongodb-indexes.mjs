/**
 * Comprehensive MongoDB Index Fixes
 * 
 * This script implements all fixes from the comprehensive analysis:
 * - Phase 1: Critical Fixes (Materials, Expenses)
 * - Phase 2: Important Fixes (Floors, Initial Expenses, Categories)
 * - Phase 3: Performance Indexes
 * 
 * IMPORTANT: This script will modify indexes. Backup recommended.
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

const results = {
  phase1: { success: [], errors: [] },
  phase2: { success: [], errors: [] },
  phase3: { success: [], errors: [] },
};

async function fixAllIndexes() {
  let client;
  
  try {
    console.log('🚀 Starting Comprehensive MongoDB Index Fixes\n');
    console.log('📡 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB);
    
    // ============================================
    // PHASE 1: CRITICAL FIXES
    // ============================================
    console.log('='.repeat(80));
    console.log('PHASE 1: CRITICAL FIXES');
    console.log('='.repeat(80));
    
    // 1.1 Fix Materials Index
    console.log('\n📋 Step 1.1: Fixing Materials Index...');
    try {
      const materialsCollection = db.collection('materials');
      
      // Check existing index
      const existingIndexes = await materialsCollection.indexes();
      const sparseIndex = existingIndexes.find(idx => 
        idx.name === 'project_materialCode_unique_sparse'
      );
      
      if (sparseIndex) {
        console.log('   Found sparse index, dropping...');
        await materialsCollection.dropIndex('project_materialCode_unique_sparse');
        console.log('   ✅ Dropped sparse index');
      }
      
      // Create partial index (more reliable than sparse)
      // Only index documents where materialCode exists and is not null
      await materialsCollection.createIndex(
        { projectId: 1, materialCode: 1 },
        {
          unique: true,
          partialFilterExpression: { 
            materialCode: { $exists: true, $type: ['string', 'number'] } 
          },
          name: 'project_materialCode_unique_partial',
          background: true,
        }
      );
      console.log('   ✅ Created partial unique index');
      
      // Verify
      const newIndexes = await materialsCollection.indexes();
      const partialIndex = newIndexes.find(idx => 
        idx.name === 'project_materialCode_unique_partial'
      );
      if (partialIndex && partialIndex.partialFilterExpression) {
        console.log('   ✅ Index verified with partial filter');
        results.phase1.success.push('Materials index fixed');
      } else {
        throw new Error('Index verification failed');
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase1.errors.push({ step: 'Materials Index', error: error.message });
    }
    
    // 1.2 Fix Expenses Index
    console.log('\n📋 Step 1.2: Fixing Expenses Index...');
    try {
      const expensesCollection = db.collection('expenses');
      
      // Check if expenseCode can be null
      const expenses = await expensesCollection.find({}).limit(100).toArray();
      const hasNullExpenseCode = expenses.some(e => 
        e.expenseCode === null || e.expenseCode === undefined
      );
      
      // Check existing index
      const existingIndexes = await expensesCollection.indexes();
      const currentIndex = existingIndexes.find(idx => 
        idx.name === 'project_expenseCode_unique'
      );
      
      if (currentIndex && !currentIndex.sparse && !currentIndex.partialFilterExpression) {
        console.log('   Found non-sparse index, updating...');
        await expensesCollection.dropIndex('project_expenseCode_unique');
        console.log('   ✅ Dropped old index');
        
        // Create sparse index (expenseCode should always be set, but make it safe)
        await expensesCollection.createIndex(
          { projectId: 1, expenseCode: 1 },
          {
            unique: true,
            sparse: true,
            name: 'project_expenseCode_unique_sparse',
            background: true,
          }
        );
        console.log('   ✅ Created sparse unique index');
        
        // Verify
        const newIndexes = await expensesCollection.indexes();
        const sparseIndex = newIndexes.find(idx => 
          idx.name === 'project_expenseCode_unique_sparse'
        );
        if (sparseIndex && sparseIndex.sparse) {
          console.log('   ✅ Index verified as sparse');
          results.phase1.success.push('Expenses index fixed');
        } else {
          throw new Error('Index verification failed');
        }
      } else {
        console.log('   ℹ️  Index already sparse or partial, skipping');
        results.phase1.success.push('Expenses index already correct');
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase1.errors.push({ step: 'Expenses Index', error: error.message });
    }
    
    // ============================================
    // PHASE 2: IMPORTANT FIXES
    // ============================================
    console.log('\n\n' + '='.repeat(80));
    console.log('PHASE 2: IMPORTANT FIXES');
    console.log('='.repeat(80));
    
    // 2.1 Add Floors Unique Index
    console.log('\n📋 Step 2.1: Adding Floors Unique Index...');
    try {
      const floorsCollection = db.collection('floors');
      
      // Check for duplicates before creating index
      const floors = await floorsCollection.find({}).toArray();
      const floorMap = new Map();
      const duplicates = [];
      
      floors.forEach(floor => {
        const key = `${floor.projectId?.toString()}-${floor.floorNumber}`;
        if (!floorMap.has(key)) {
          floorMap.set(key, []);
        }
        floorMap.get(key).push(floor._id.toString());
      });
      
      const duplicateKeys = Array.from(floorMap.entries())
        .filter(([key, ids]) => ids.length > 1);
      
      if (duplicateKeys.length > 0) {
        console.log(`   ⚠️  Found ${duplicateKeys.length} duplicate floor numbers per project`);
        console.log('   Removing duplicates (keeping first occurrence)...');
        
        for (const [key, ids] of duplicateKeys) {
          // Keep first, remove rest
          const toRemove = ids.slice(1);
          for (const id of toRemove) {
            await floorsCollection.deleteOne({ _id: new ObjectId(id) });
            console.log(`   Removed duplicate floor: ${id}`);
          }
        }
      }
      
      // Check if index already exists
      const existingIndexes = await floorsCollection.indexes();
      const existingIndex = existingIndexes.find(idx => 
        idx.name === 'project_floorNumber_unique'
      );
      
      if (!existingIndex) {
        await floorsCollection.createIndex(
          { projectId: 1, floorNumber: 1 },
          {
            unique: true,
            name: 'project_floorNumber_unique',
            background: true,
          }
        );
        console.log('   ✅ Created unique index on { projectId, floorNumber }');
        results.phase2.success.push('Floors unique index added');
      } else {
        console.log('   ℹ️  Index already exists');
        results.phase2.success.push('Floors unique index already exists');
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase2.errors.push({ step: 'Floors Index', error: error.message });
    }
    
    // 2.2 Add Initial Expenses Unique Index
    console.log('\n📋 Step 2.2: Adding Initial Expenses Unique Index...');
    try {
      const initialExpensesCollection = db.collection('initial_expenses');
      
      // Check for duplicates
      const initialExpenses = await initialExpensesCollection.find({}).toArray();
      const expenseMap = new Map();
      const duplicates = [];
      
      initialExpenses.forEach(expense => {
        const key = `${expense.projectId?.toString()}-${expense.expenseCode || 'null'}`;
        if (!expenseMap.has(key)) {
          expenseMap.set(key, []);
        }
        expenseMap.get(key).push(expense._id.toString());
      });
      
      const duplicateKeys = Array.from(expenseMap.entries())
        .filter(([key, ids]) => ids.length > 1);
      
      if (duplicateKeys.length > 0) {
        console.log(`   ⚠️  Found ${duplicateKeys.length} duplicate expense codes per project`);
        console.log('   Removing duplicates (keeping first occurrence)...');
        
        for (const [key, ids] of duplicateKeys) {
          const toRemove = ids.slice(1);
          for (const id of toRemove) {
            await initialExpensesCollection.deleteOne({ _id: new ObjectId(id) });
            console.log(`   Removed duplicate initial expense: ${id}`);
          }
        }
      }
      
      // Check if index already exists
      const existingIndexes = await initialExpensesCollection.indexes();
      const existingIndex = existingIndexes.find(idx => 
        idx.name === 'project_expenseCode_unique_sparse'
      );
      
      if (!existingIndex) {
        await initialExpensesCollection.createIndex(
          { projectId: 1, expenseCode: 1 },
          {
            unique: true,
            sparse: true,
            name: 'project_expenseCode_unique_sparse',
            background: true,
          }
        );
        console.log('   ✅ Created sparse unique index on { projectId, expenseCode }');
        results.phase2.success.push('Initial expenses unique index added');
      } else {
        console.log('   ℹ️  Index already exists');
        results.phase2.success.push('Initial expenses unique index already exists');
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase2.errors.push({ step: 'Initial Expenses Index', error: error.message });
    }
    
    // 2.3 Add Categories Unique Index
    console.log('\n📋 Step 2.3: Adding Categories Unique Index...');
    try {
      const categoriesCollection = db.collection('categories');
      
      // Check for duplicates
      const categories = await categoriesCollection.find({}).toArray();
      const nameMap = new Map();
      
      categories.forEach(cat => {
        const name = cat.name?.toLowerCase();
        if (name) {
          if (!nameMap.has(name)) {
            nameMap.set(name, []);
          }
          nameMap.get(name).push(cat._id.toString());
        }
      });
      
      const duplicateNames = Array.from(nameMap.entries())
        .filter(([name, ids]) => ids.length > 1);
      
      if (duplicateNames.length > 0) {
        console.log(`   ⚠️  Found ${duplicateNames.length} duplicate category names`);
        console.log('   Removing duplicates (keeping first occurrence)...');
        
        for (const [name, ids] of duplicateNames) {
          const toRemove = ids.slice(1);
          for (const id of toRemove) {
            await categoriesCollection.deleteOne({ _id: new ObjectId(id) });
            console.log(`   Removed duplicate category: ${id} (name: ${name})`);
          }
        }
      }
      
      // Check if index already exists
      const existingIndexes = await categoriesCollection.indexes();
      const existingIndex = existingIndexes.find(idx => 
        idx.name === 'name_unique'
      );
      
      if (!existingIndex) {
        await categoriesCollection.createIndex(
          { name: 1 },
          {
            unique: true,
            name: 'name_unique',
            background: true,
          }
        );
        console.log('   ✅ Created unique index on name');
        results.phase2.success.push('Categories unique index added');
      } else {
        console.log('   ℹ️  Index already exists');
        results.phase2.success.push('Categories unique index already exists');
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase2.errors.push({ step: 'Categories Index', error: error.message });
    }
    
    // ============================================
    // PHASE 3: PERFORMANCE INDEXES
    // ============================================
    console.log('\n\n' + '='.repeat(80));
    console.log('PHASE 3: PERFORMANCE INDEXES');
    console.log('='.repeat(80));
    
    // 3.1 Materials Performance Indexes
    console.log('\n📋 Step 3.1: Adding Materials Performance Indexes...');
    try {
      const materialsCollection = db.collection('materials');
      const existingIndexes = await materialsCollection.indexes();
      const indexNames = existingIndexes.map(idx => idx.name);
      
      const indexesToCreate = [
        { key: { projectId: 1, createdAt: -1 }, name: 'projectId_createdAt_desc' },
        { key: { supplierName: 1 }, name: 'supplierName_idx' },
        { key: { categoryId: 1 }, name: 'categoryId_idx' },
      ];
      
      for (const indexDef of indexesToCreate) {
        if (!indexNames.includes(indexDef.name)) {
          await materialsCollection.createIndex(
            indexDef.key,
            { name: indexDef.name, background: true }
          );
          console.log(`   ✅ Created index: ${indexDef.name}`);
          results.phase3.success.push(`Materials: ${indexDef.name}`);
        } else {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase3.errors.push({ step: 'Materials Performance Indexes', error: error.message });
    }
    
    // 3.2 Expenses Performance Indexes
    console.log('\n📋 Step 3.2: Adding Expenses Performance Indexes...');
    try {
      const expensesCollection = db.collection('expenses');
      const existingIndexes = await expensesCollection.indexes();
      const indexNames = existingIndexes.map(idx => idx.name);
      
      const indexesToCreate = [
        { key: { projectId: 1, createdAt: -1 }, name: 'projectId_createdAt_desc' },
        { key: { vendor: 1 }, name: 'vendor_idx' },
      ];
      
      for (const indexDef of indexesToCreate) {
        if (!indexNames.includes(indexDef.name)) {
          await expensesCollection.createIndex(
            indexDef.key,
            { name: indexDef.name, background: true }
          );
          console.log(`   ✅ Created index: ${indexDef.name}`);
          results.phase3.success.push(`Expenses: ${indexDef.name}`);
        } else {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase3.errors.push({ step: 'Expenses Performance Indexes', error: error.message });
    }
    
    // 3.3 Initial Expenses Performance Indexes
    console.log('\n📋 Step 3.3: Adding Initial Expenses Performance Indexes...');
    try {
      const initialExpensesCollection = db.collection('initial_expenses');
      const existingIndexes = await initialExpensesCollection.indexes();
      const indexNames = existingIndexes.map(idx => idx.name);
      
      const indexesToCreate = [
        { key: { projectId: 1, createdAt: -1 }, name: 'projectId_createdAt_desc' },
        { key: { status: 1 }, name: 'status_idx' },
        { key: { enteredBy: 1 }, name: 'enteredBy_idx' },
      ];
      
      for (const indexDef of indexesToCreate) {
        if (!indexNames.includes(indexDef.name)) {
          await initialExpensesCollection.createIndex(
            indexDef.key,
            { name: indexDef.name, background: true }
          );
          console.log(`   ✅ Created index: ${indexDef.name}`);
          results.phase3.success.push(`Initial Expenses: ${indexDef.name}`);
        } else {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase3.errors.push({ step: 'Initial Expenses Performance Indexes', error: error.message });
    }
    
    // 3.4 Floors Performance Indexes
    console.log('\n📋 Step 3.4: Adding Floors Performance Indexes...');
    try {
      const floorsCollection = db.collection('floors');
      const existingIndexes = await floorsCollection.indexes();
      const indexNames = existingIndexes.map(idx => idx.name);
      
      const indexesToCreate = [
        { key: { projectId: 1, status: 1 }, name: 'project_status_idx' },
        { key: { projectId: 1, createdAt: -1 }, name: 'projectId_createdAt_desc' },
      ];
      
      for (const indexDef of indexesToCreate) {
        if (!indexNames.includes(indexDef.name)) {
          await floorsCollection.createIndex(
            indexDef.key,
            { name: indexDef.name, background: true }
          );
          console.log(`   ✅ Created index: ${indexDef.name}`);
          results.phase3.success.push(`Floors: ${indexDef.name}`);
        } else {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase3.errors.push({ step: 'Floors Performance Indexes', error: error.message });
    }
    
    // 3.5 Investors Performance Indexes
    console.log('\n📋 Step 3.5: Adding Investors Performance Indexes...');
    try {
      const investorsCollection = db.collection('investors');
      const existingIndexes = await investorsCollection.indexes();
      const indexNames = existingIndexes.map(idx => idx.name);
      
      const indexesToCreate = [
        { key: { userId: 1 }, name: 'userId_idx' },
        { key: { status: 1 }, name: 'status_idx' },
        { key: { email: 1 }, name: 'email_idx' },
      ];
      
      for (const indexDef of indexesToCreate) {
        if (!indexNames.includes(indexDef.name)) {
          await investorsCollection.createIndex(
            indexDef.key,
            { name: indexDef.name, background: true }
          );
          console.log(`   ✅ Created index: ${indexDef.name}`);
          results.phase3.success.push(`Investors: ${indexDef.name}`);
        } else {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase3.errors.push({ step: 'Investors Performance Indexes', error: error.message });
    }
    
    // 3.6 Project Finances Performance Indexes
    console.log('\n📋 Step 3.6: Adding Project Finances Performance Indexes...');
    try {
      const projectFinancesCollection = db.collection('project_finances');
      const existingIndexes = await projectFinancesCollection.indexes();
      const indexNames = existingIndexes.map(idx => idx.name);
      
      const indexesToCreate = [
        { key: { projectId: 1 }, name: 'projectId_unique', unique: true },
        { key: { lastUpdated: -1 }, name: 'lastUpdated_desc' },
      ];
      
      for (const indexDef of indexesToCreate) {
        if (!indexNames.includes(indexDef.name)) {
          const options = { name: indexDef.name, background: true };
          if (indexDef.unique) {
            options.unique = true;
          }
          await projectFinancesCollection.createIndex(indexDef.key, options);
          console.log(`   ✅ Created index: ${indexDef.name}`);
          results.phase3.success.push(`Project Finances: ${indexDef.name}`);
        } else {
          console.log(`   ℹ️  Index already exists: ${indexDef.name}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Error:', error.message);
      results.phase3.errors.push({ step: 'Project Finances Performance Indexes', error: error.message });
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n\n' + '='.repeat(80));
    console.log('IMPLEMENTATION SUMMARY');
    console.log('='.repeat(80));
    
    const totalSuccess = results.phase1.success.length + 
                        results.phase2.success.length + 
                        results.phase3.success.length;
    const totalErrors = results.phase1.errors.length + 
                       results.phase2.errors.length + 
                       results.phase3.errors.length;
    
    console.log(`\n✅ Successful: ${totalSuccess}`);
    console.log(`❌ Errors: ${totalErrors}`);
    
    if (results.phase1.errors.length > 0) {
      console.log('\n⚠️  Phase 1 Errors:');
      results.phase1.errors.forEach(err => {
        console.log(`   - ${err.step}: ${err.error}`);
      });
    }
    
    if (results.phase2.errors.length > 0) {
      console.log('\n⚠️  Phase 2 Errors:');
      results.phase2.errors.forEach(err => {
        console.log(`   - ${err.step}: ${err.error}`);
      });
    }
    
    if (results.phase3.errors.length > 0) {
      console.log('\n⚠️  Phase 3 Errors:');
      results.phase3.errors.forEach(err => {
        console.log(`   - ${err.step}: ${err.error}`);
      });
    }
    
    if (totalErrors === 0) {
      console.log('\n🎉 All fixes implemented successfully!');
    } else {
      console.log('\n⚠️  Some fixes had errors. Please review above.');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ Connection closed');
    }
  }
}

fixAllIndexes()
  .then(() => {
    console.log('\n✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

