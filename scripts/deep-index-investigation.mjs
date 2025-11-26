/**
 * Deep Index Investigation
 * 
 * This script investigates why the sparse index is not working
 * and checks all unique indexes for potential issues
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'kisheka_prod';

async function deepInvestigation() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    
    console.log('🔍 DEEP INDEX INVESTIGATION\n');
    
    // 1. Check materials index in detail
    console.log('='.repeat(80));
    console.log('1. MATERIALS INDEX DETAILED CHECK');
    console.log('='.repeat(80));
    
    const materialsCollection = db.collection('materials');
    const materials = await materialsCollection.find({}).toArray();
    
    console.log(`\nTotal materials: ${materials.length}`);
    
    // Check each material's materialCode field
    materials.forEach((m, i) => {
      console.log(`\nMaterial ${i + 1}:`);
      console.log(`  _id: ${m._id}`);
      console.log(`  projectId: ${m.projectId}`);
      console.log(`  materialCode: ${JSON.stringify(m.materialCode)}`);
      console.log(`  materialCode type: ${typeof m.materialCode}`);
      console.log(`  materialCode === null: ${m.materialCode === null}`);
      console.log(`  materialCode === undefined: ${m.materialCode === undefined}`);
      console.log(`  hasOwnProperty('materialCode'): ${m.hasOwnProperty('materialCode')}`);
    });
    
    // Check index stats
    const indexStats = await materialsCollection.aggregate([
      { $indexStats: {} }
    ]).toArray();
    
    console.log('\n\nIndex Statistics:');
    indexStats.forEach(stat => {
      if (stat.name === 'project_materialCode_unique_sparse') {
        console.log(`  ${stat.name}:`);
        console.log(`    Accesses: ${stat.accesses.ops}`);
        console.log(`    Since: ${stat.accesses.since}`);
      }
    });
    
    // Try to understand why sparse index might not work
    console.log('\n\nTesting Sparse Index Behavior:');
    
    // Check if field exists vs is null
    const withField = await materialsCollection.countDocuments({
      materialCode: { $exists: true }
    });
    const withNull = await materialsCollection.countDocuments({
      materialCode: null
    });
    const withoutField = await materialsCollection.countDocuments({
      materialCode: { $exists: false }
    });
    
    console.log(`  Materials with materialCode field (exists: true): ${withField}`);
    console.log(`  Materials with materialCode = null: ${withNull}`);
    console.log(`  Materials without materialCode field (exists: false): ${withoutField}`);
    
    // 2. Check all unique indexes
    console.log('\n\n' + '='.repeat(80));
    console.log('2. ALL UNIQUE INDEXES CHECK');
    console.log('='.repeat(80));
    
    const collections = await db.listCollections().toArray();
    const uniqueIndexIssues = [];
    
    for (const collInfo of collections) {
      const collection = db.collection(collInfo.name);
      const indexes = await collection.indexes();
      
      indexes.forEach(index => {
        if (index.unique && !index.sparse && !index.partialFilterExpression) {
          const indexFields = Object.keys(index.key);
          
          // Check if any documents have null/undefined in these fields
          const sampleDocs = await collection.find({}).limit(100).toArray();
          const nullFields = new Set();
          
          sampleDocs.forEach(doc => {
            indexFields.forEach(field => {
              if (doc[field] === null || doc[field] === undefined) {
                nullFields.add(field);
              }
            });
          });
          
          if (nullFields.size > 0) {
            // Count potential duplicates
            const nullCounts = {};
            nullFields.forEach(field => {
              const count = sampleDocs.filter(d => 
                d[field] === null || d[field] === undefined
              ).length;
              nullCounts[field] = count;
            });
            
            uniqueIndexIssues.push({
              collection: collInfo.name,
              index: index.name,
              fields: indexFields,
              nullableFields: Array.from(nullFields),
              nullCounts: nullCounts,
            });
          }
        }
      });
    }
    
    if (uniqueIndexIssues.length > 0) {
      console.log('\n⚠️  Found unique indexes that may have null value issues:');
      uniqueIndexIssues.forEach(issue => {
        console.log(`\n  Collection: ${issue.collection}`);
        console.log(`  Index: ${issue.index}`);
        console.log(`  Fields: ${issue.fields.join(', ')}`);
        console.log(`  Nullable fields: ${issue.nullableFields.join(', ')}`);
        console.log(`  Null counts: ${JSON.stringify(issue.nullCounts)}`);
      });
    } else {
      console.log('\n✅ No obvious unique index issues found');
    }
    
    // 3. Check expenses collection
    console.log('\n\n' + '='.repeat(80));
    console.log('3. EXPENSES COLLECTION CHECK');
    console.log('='.repeat(80));
    
    const expensesCollection = db.collection('expenses');
    const expenses = await expensesCollection.find({}).toArray();
    
    console.log(`\nTotal expenses: ${expenses.length}`);
    
    expenses.forEach((e, i) => {
      console.log(`\nExpense ${i + 1}:`);
      console.log(`  _id: ${e._id}`);
      console.log(`  projectId: ${e.projectId}`);
      console.log(`  expenseCode: ${JSON.stringify(e.expenseCode)}`);
      console.log(`  expenseCode type: ${typeof e.expenseCode}`);
    });
    
    // Check for duplicate expenseCode
    const expenseCodeMap = new Map();
    expenses.forEach(e => {
      const key = `${e.projectId?.toString()}-${e.expenseCode || 'null'}`;
      if (!expenseCodeMap.has(key)) {
        expenseCodeMap.set(key, []);
      }
      expenseCodeMap.get(key).push(e._id.toString());
    });
    
    const duplicateExpenseCodes = Array.from(expenseCodeMap.entries())
      .filter(([key, ids]) => ids.length > 1);
    
    if (duplicateExpenseCodes.length > 0) {
      console.log(`\n⚠️  Found ${duplicateExpenseCodes.length} duplicate expenseCode combinations`);
    }
    
    // 4. Check initial_expenses
    console.log('\n\n' + '='.repeat(80));
    console.log('4. INITIAL EXPENSES COLLECTION CHECK');
    console.log('='.repeat(80));
    
    const initialExpensesCollection = db.collection('initial_expenses');
    const initialExpenses = await initialExpensesCollection.find({}).toArray();
    
    console.log(`\nTotal initial expenses: ${initialExpenses.length}`);
    
    initialExpenses.forEach((e, i) => {
      console.log(`\nInitial Expense ${i + 1}:`);
      console.log(`  _id: ${e._id}`);
      console.log(`  projectId: ${e.projectId}`);
      console.log(`  expenseCode: ${JSON.stringify(e.expenseCode)}`);
    });
    
    // 5. Check floors
    console.log('\n\n' + '='.repeat(80));
    console.log('5. FLOORS COLLECTION CHECK');
    console.log('='.repeat(80));
    
    const floorsCollection = db.collection('floors');
    const floors = await floorsCollection.find({}).toArray();
    
    console.log(`\nTotal floors: ${floors.length}`);
    
    // Check for duplicate floor numbers per project
    const floorNumberMap = new Map();
    floors.forEach(f => {
      const key = `${f.projectId?.toString()}-${f.floorNumber}`;
      if (!floorNumberMap.has(key)) {
        floorNumberMap.set(key, []);
      }
      floorNumberMap.get(key).push(f._id.toString());
    });
    
    const duplicateFloors = Array.from(floorNumberMap.entries())
      .filter(([key, ids]) => ids.length > 1);
    
    if (duplicateFloors.length > 0) {
      console.log(`\n⚠️  Found ${duplicateFloors.length} duplicate floor numbers per project`);
      duplicateFloors.forEach(([key, ids]) => {
        console.log(`  ${key}: ${ids.length} floors`);
      });
    } else {
      console.log('\n✅ No duplicate floor numbers found');
    }
    
    // 6. Test actual insert to see the error
    console.log('\n\n' + '='.repeat(80));
    console.log('6. TESTING MATERIAL INSERT (DRY RUN)');
    console.log('='.repeat(80));
    
    // Get a project ID
    const projects = await db.collection('projects').find({}).limit(1).toArray();
    if (projects.length > 0) {
      const testProjectId = projects[0]._id;
      console.log(`\nUsing project: ${testProjectId}`);
      
      // Check existing materials for this project
      const existingMaterials = await materialsCollection.find({
        projectId: testProjectId
      }).toArray();
      
      console.log(`\nExisting materials for this project: ${existingMaterials.length}`);
      existingMaterials.forEach((m, i) => {
        console.log(`  ${i + 1}. materialCode: ${JSON.stringify(m.materialCode)}`);
      });
      
      // Check if we can find documents that would violate the index
      const nullCodeMaterials = await materialsCollection.find({
        projectId: testProjectId,
        $or: [
          { materialCode: null },
          { materialCode: { $exists: false } },
        ]
      }).toArray();
      
      console.log(`\nMaterials with null/missing materialCode: ${nullCodeMaterials.length}`);
      
      if (nullCodeMaterials.length > 1) {
        console.log('\n⚠️  CRITICAL: Multiple materials with null materialCode exist!');
        console.log('   This should be allowed by sparse index, but error suggests otherwise.');
        console.log('\n   Possible causes:');
        console.log('   1. Index was created but MongoDB hasn\'t fully applied it');
        console.log('   2. Index is sparse but field exists as null (not missing)');
        console.log('   3. Index needs to be rebuilt');
        console.log('   4. MongoDB version compatibility issue');
      }
    }
    
    // 7. Check MongoDB version and index options
    console.log('\n\n' + '='.repeat(80));
    console.log('7. MONGODB VERSION & INDEX DETAILS');
    console.log('='.repeat(80));
    
    const serverStatus = await db.admin().serverStatus();
    console.log(`\nMongoDB Version: ${serverStatus.version}`);
    
    // Get detailed index info
    const materialsIndexes = await materialsCollection.indexes();
    const materialCodeIndex = materialsIndexes.find(idx => 
      idx.name.includes('materialCode')
    );
    
    if (materialCodeIndex) {
      console.log('\nDetailed Index Information:');
      console.log(JSON.stringify(materialCodeIndex, null, 2));
      
      // Check if index is actually sparse
      const indexInfo = await db.command({
        listIndexes: 'materials',
        filter: { name: materialCodeIndex.name }
      });
      
      console.log('\nIndex from listIndexes:');
      console.log(JSON.stringify(indexInfo, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

deepInvestigation()
  .then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });

