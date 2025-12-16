/**
 * Comprehensive MongoDB Database Analysis
 * 
 * This script analyzes:
 * 1. All collections and their schemas
 * 2. All indexes and their configurations
 * 3. Data integrity issues
 * 4. Schema mismatches
 * 5. Relationship issues
 * 6. Index problems
 * 7. Data consistency issues
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
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'kisheka_prod';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Analysis results
const analysis = {
  collections: {},
  indexes: {},
  issues: [],
  recommendations: [],
  statistics: {},
};

async function analyzeCollection(db, collectionName) {
  const collection = db.collection(collectionName);
  const stats = await db.command({ collStats: collectionName });
  
  // Get indexes
  const indexes = await collection.indexes();
  
  // Get sample documents
  const sampleDocs = await collection.find({}).limit(5).toArray();
  
  // Get total count
  const totalCount = await collection.countDocuments({});
  
  // Analyze schema from samples
  const schema = analyzeSchema(sampleDocs);
  
  // Check for common issues
  const issues = [];
  
  // Check for null/undefined in required fields
  // Check for orphaned references
  // Check for duplicate keys
  // Check for missing indexes
  
  return {
    name: collectionName,
    count: totalCount,
    size: stats.size || 0,
    avgObjSize: stats.avgObjSize || 0,
    indexes: indexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique || false,
      sparse: idx.sparse || false,
      partialFilterExpression: idx.partialFilterExpression || null,
    })),
    schema: schema,
    sampleDocs: sampleDocs.length,
    issues: issues,
  };
}

function analyzeSchema(documents) {
  if (documents.length === 0) return {};
  
  const schema = {};
  
  documents.forEach(doc => {
    Object.keys(doc).forEach(key => {
      if (!schema[key]) {
        schema[key] = {
          type: typeof doc[key],
          isArray: Array.isArray(doc[key]),
          isObject: typeof doc[key] === 'object' && doc[key] !== null && !Array.isArray(doc[key]) && !(doc[key] instanceof ObjectId) && !(doc[key] instanceof Date),
          isObjectId: doc[key] instanceof ObjectId,
          isDate: doc[key] instanceof Date,
          nullable: doc[key] === null || doc[key] === undefined,
          sampleValues: new Set(),
        };
      }
      
      if (doc[key] !== null && doc[key] !== undefined) {
        schema[key].nullable = false;
        if (schema[key].sampleValues.size < 3) {
          if (doc[key] instanceof ObjectId) {
            schema[key].sampleValues.add('ObjectId');
          } else if (doc[key] instanceof Date) {
            schema[key].sampleValues.add('Date');
          } else if (typeof doc[key] === 'string' && doc[key].length < 50) {
            schema[key].sampleValues.add(doc[key]);
          } else if (typeof doc[key] === 'number') {
            schema[key].sampleValues.add(doc[key]);
          } else if (typeof doc[key] === 'boolean') {
            schema[key].sampleValues.add(doc[key]);
          }
        }
      }
    });
  });
  
  return schema;
}

async function checkIndexIssues(db, collectionName) {
  const collection = db.collection(collectionName);
  const indexes = await collection.indexes();
  const issues = [];
  
  indexes.forEach(index => {
    // Check for non-sparse unique indexes on nullable fields
    if (index.unique && !index.sparse && !index.partialFilterExpression) {
      const indexFields = Object.keys(index.key);
      // This is a potential issue if any field can be null
      issues.push({
        type: 'index',
        severity: 'warning',
        message: `Unique index "${index.name}" is not sparse - may cause issues with null values`,
        index: index.name,
        fields: indexFields,
      });
    }
  });
  
  return issues;
}

async function checkDataIntegrity(db) {
  const issues = [];
  
  // Check materials collection
  const materials = await db.collection('materials').find({}).toArray();
  
  // Check for orphaned project references
  const projectIds = new Set(materials.map(m => m.projectId?.toString()).filter(Boolean));
  const existingProjects = await db.collection('projects').find({
    _id: { $in: Array.from(projectIds).map(id => new ObjectId(id)) }
  }).toArray();
  const existingProjectIds = new Set(existingProjects.map(p => p._id.toString()));
  
  const orphanedMaterials = materials.filter(m => {
    const projectId = m.projectId?.toString();
    return projectId && !existingProjectIds.has(projectId);
  });
  
  if (orphanedMaterials.length > 0) {
    issues.push({
      type: 'data_integrity',
      severity: 'error',
      message: `${orphanedMaterials.length} materials reference non-existent projects`,
      collection: 'materials',
      count: orphanedMaterials.length,
      sampleIds: orphanedMaterials.slice(0, 5).map(m => m._id.toString()),
    });
  }
  
  // Check for duplicate materialCode issues
  const materialsWithCode = materials.filter(m => m.materialCode !== null && m.materialCode !== undefined);
  const materialCodeMap = new Map();
  materialsWithCode.forEach(m => {
    const key = `${m.projectId?.toString()}-${m.materialCode}`;
    if (!materialCodeMap.has(key)) {
      materialCodeMap.set(key, []);
    }
    materialCodeMap.get(key).push(m._id.toString());
  });
  
  const duplicates = Array.from(materialCodeMap.entries()).filter(([key, ids]) => ids.length > 1);
  if (duplicates.length > 0) {
    issues.push({
      type: 'data_integrity',
      severity: 'error',
      message: `Found ${duplicates.length} duplicate materialCode combinations`,
      collection: 'materials',
      duplicates: duplicates.slice(0, 5),
    });
  }
  
  // Check materials with null materialCode per project
  const nullCodeByProject = new Map();
  materials.filter(m => !m.materialCode || m.materialCode === null).forEach(m => {
    const projectId = m.projectId?.toString();
    if (!nullCodeByProject.has(projectId)) {
      nullCodeByProject.set(projectId, []);
    }
    nullCodeByProject.get(projectId).push(m._id.toString());
  });
  
  const multipleNullCodes = Array.from(nullCodeByProject.entries()).filter(([pid, ids]) => ids.length > 1);
  if (multipleNullCodes.length > 0) {
    issues.push({
      type: 'index_issue',
      severity: 'error',
      message: `Found ${multipleNullCodes.length} projects with multiple materials having null materialCode`,
      collection: 'materials',
      details: `This should be allowed with sparse index, but error suggests index is not working correctly`,
      projects: multipleNullCodes.slice(0, 5).map(([pid, ids]) => ({
        projectId: pid,
        materialCount: ids.length,
      })),
    });
  }
  
  // Check expenses
  const expenses = await db.collection('expenses').find({}).toArray();
  const expenseProjectIds = new Set(expenses.map(e => e.projectId?.toString()).filter(Boolean));
  const orphanedExpenses = expenses.filter(e => {
    const projectId = e.projectId?.toString();
    return projectId && !existingProjectIds.has(projectId);
  });
  
  if (orphanedExpenses.length > 0) {
    issues.push({
      type: 'data_integrity',
      severity: 'error',
      message: `${orphanedExpenses.length} expenses reference non-existent projects`,
      collection: 'expenses',
      count: orphanedExpenses.length,
    });
  }
  
  // Check initial_expenses
  const initialExpenses = await db.collection('initial_expenses').find({}).toArray();
  const initialExpenseProjectIds = new Set(initialExpenses.map(e => e.projectId?.toString()).filter(Boolean));
  const orphanedInitialExpenses = initialExpenses.filter(e => {
    const projectId = e.projectId?.toString();
    return projectId && !existingProjectIds.has(projectId);
  });
  
  if (orphanedInitialExpenses.length > 0) {
    issues.push({
      type: 'data_integrity',
      severity: 'error',
      message: `${orphanedInitialExpenses.length} initial expenses reference non-existent projects`,
      collection: 'initial_expenses',
      count: orphanedInitialExpenses.length,
    });
  }
  
  // Check investors
  const investors = await db.collection('investors').find({}).toArray();
  const investorUserIds = new Set(investors.map(i => i.userId?.toString()).filter(Boolean));
  const users = await db.collection('users').find({}).toArray();
  const existingUserIds = new Set(users.map(u => u._id.toString()));
  
  const orphanedInvestors = investors.filter(i => {
    const userId = i.userId?.toString();
    return userId && !existingUserIds.has(userId);
  });
  
  if (orphanedInvestors.length > 0) {
    issues.push({
      type: 'data_integrity',
      severity: 'warning',
      message: `${orphanedInvestors.length} investors reference non-existent users`,
      collection: 'investors',
      count: orphanedInvestors.length,
    });
  }
  
  // Check investor project allocations
  investors.forEach(investor => {
    if (investor.projectAllocations && Array.isArray(investor.projectAllocations)) {
      investor.projectAllocations.forEach(allocation => {
        if (allocation.projectId) {
          const projectId = allocation.projectId.toString();
          if (!existingProjectIds.has(projectId)) {
            issues.push({
              type: 'data_integrity',
              severity: 'warning',
              message: `Investor ${investor._id} has allocation to non-existent project ${projectId}`,
              collection: 'investors',
              investorId: investor._id.toString(),
              projectId: projectId,
            });
          }
        }
      });
    }
  });
  
  // Check floors
  const floors = await db.collection('floors').find({}).toArray();
  const floorProjectIds = new Set(floors.map(f => f.projectId?.toString()).filter(Boolean));
  const orphanedFloors = floors.filter(f => {
    const projectId = f.projectId?.toString();
    return projectId && !existingProjectIds.has(projectId);
  });
  
  if (orphanedFloors.length > 0) {
    issues.push({
      type: 'data_integrity',
      severity: 'error',
      message: `${orphanedFloors.length} floors reference non-existent projects`,
      collection: 'floors',
      count: orphanedFloors.length,
    });
  }
  
  // Check for duplicate floor numbers per project
  const floorNumberMap = new Map();
  floors.forEach(f => {
    const key = `${f.projectId?.toString()}-${f.floorNumber}`;
    if (!floorNumberMap.has(key)) {
      floorNumberMap.set(key, []);
    }
    floorNumberMap.get(key).push(f._id.toString());
  });
  
  const duplicateFloors = Array.from(floorNumberMap.entries()).filter(([key, ids]) => ids.length > 1);
  if (duplicateFloors.length > 0) {
    issues.push({
      type: 'data_integrity',
      severity: 'error',
      message: `Found ${duplicateFloors.length} duplicate floor numbers per project`,
      collection: 'floors',
      duplicates: duplicateFloors.slice(0, 5),
    });
  }
  
  return issues;
}

async function checkSchemaMismatches(db) {
  const issues = [];
  
  // Check materials collection schema vs expected
  const materials = await db.collection('materials').find({}).limit(100).toArray();
  
  // Check for old field names
  const oldFieldNames = ['materialName', 'quantity', 'supplier', 'receiptUrl', 'totalPrice'];
  materials.forEach(material => {
    oldFieldNames.forEach(oldField => {
      if (material[oldField] !== undefined) {
        issues.push({
          type: 'schema_mismatch',
          severity: 'warning',
          message: `Material ${material._id} still has old field "${oldField}"`,
          collection: 'materials',
          materialId: material._id.toString(),
          oldField: oldField,
        });
      }
    });
  });
  
  // Check for missing required fields
  materials.forEach(material => {
    const requiredFields = ['projectId', 'name', 'quantityPurchased', 'supplierName', 'status'];
    requiredFields.forEach(field => {
      if (material[field] === undefined || material[field] === null) {
        issues.push({
          type: 'schema_mismatch',
          severity: 'error',
          message: `Material ${material._id} missing required field "${field}"`,
          collection: 'materials',
          materialId: material._id.toString(),
          missingField: field,
        });
      }
    });
  });
  
  return issues;
}

async function comprehensiveAnalysis() {
  let client;
  
  try {
    console.log('🔍 Starting Comprehensive MongoDB Database Analysis...\n');
    console.log('📡 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(MONGODB_DB);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections\n`);
    
    // Analyze each collection
    for (const collInfo of collections) {
      const collectionName = collInfo.name;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 Analyzing Collection: ${collectionName}`);
      console.log('='.repeat(80));
      
      try {
        const collectionData = await analyzeCollection(db, collectionName);
        analysis.collections[collectionName] = collectionData;
        
        console.log(`   Count: ${collectionData.count}`);
        console.log(`   Size: ${(collectionData.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Indexes: ${collectionData.indexes.length}`);
        
        // Check index issues
        const indexIssues = await checkIndexIssues(db, collectionName);
        collectionData.issues.push(...indexIssues);
        
        if (collectionData.issues.length > 0) {
          console.log(`   ⚠️  Issues found: ${collectionData.issues.length}`);
        }
        
        // Display indexes
        if (collectionData.indexes.length > 0) {
          console.log(`\n   Indexes:`);
          collectionData.indexes.forEach((idx, i) => {
            console.log(`     ${i + 1}. ${idx.name}`);
            console.log(`        Keys: ${JSON.stringify(idx.key)}`);
            if (idx.unique) console.log(`        ⚠️  UNIQUE`);
            if (idx.sparse) console.log(`        ✅ SPARSE`);
            if (idx.partialFilterExpression) {
              console.log(`        📝 Partial Filter: ${JSON.stringify(idx.partialFilterExpression)}`);
            }
          });
        }
        
        // Display schema
        if (Object.keys(collectionData.schema).length > 0) {
          console.log(`\n   Schema (from samples):`);
          Object.entries(collectionData.schema).slice(0, 10).forEach(([field, info]) => {
            const typeInfo = info.isObjectId ? 'ObjectId' : 
                           info.isDate ? 'Date' :
                           info.isArray ? 'Array' :
                           info.isObject ? 'Object' :
                           info.type;
            const nullable = info.nullable ? ' (nullable)' : '';
            console.log(`     - ${field}: ${typeInfo}${nullable}`);
          });
          if (Object.keys(collectionData.schema).length > 10) {
            console.log(`     ... and ${Object.keys(collectionData.schema).length - 10} more fields`);
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Error analyzing ${collectionName}:`, error.message);
        analysis.collections[collectionName] = {
          name: collectionName,
          error: error.message,
        };
      }
    }
    
    // Data integrity checks
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('🔍 Running Data Integrity Checks...');
    console.log('='.repeat(80));
    
    const integrityIssues = await checkDataIntegrity(db);
    analysis.issues.push(...integrityIssues);
    
    integrityIssues.forEach(issue => {
      const icon = issue.severity === 'error' ? '❌' : '⚠️';
      console.log(`\n${icon} ${issue.severity.toUpperCase()}: ${issue.message}`);
      if (issue.collection) console.log(`   Collection: ${issue.collection}`);
      if (issue.count) console.log(`   Count: ${issue.count}`);
    });
    
    // Schema mismatch checks
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('🔍 Checking Schema Mismatches...');
    console.log('='.repeat(80));
    
    const schemaIssues = await checkSchemaMismatches(db);
    analysis.issues.push(...schemaIssues);
    
    const schemaErrors = schemaIssues.filter(i => i.severity === 'error');
    const schemaWarnings = schemaIssues.filter(i => i.severity === 'warning');
    
    console.log(`\n   Errors: ${schemaErrors.length}`);
    console.log(`   Warnings: ${schemaWarnings.length}`);
    
    // Check materials index specifically
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('🔍 Detailed Materials Index Analysis...');
    console.log('='.repeat(80));
    
    const materialsCollection = db.collection('materials');
    const materialsIndexes = await materialsCollection.indexes();
    const materialCodeIndex = materialsIndexes.find(idx => 
      idx.name === 'project_materialCode_unique_sparse' || 
      idx.name === 'project_materialCode_unique'
    );
    
    if (materialCodeIndex) {
      console.log(`\n   Found index: ${materialCodeIndex.name}`);
      console.log(`   Keys: ${JSON.stringify(materialCodeIndex.key)}`);
      console.log(`   Unique: ${materialCodeIndex.unique}`);
      console.log(`   Sparse: ${materialCodeIndex.sparse || false}`);
      console.log(`   Partial Filter: ${materialCodeIndex.partialFilterExpression || 'None'}`);
      
      // Test the index behavior
      const materials = await materialsCollection.find({}).toArray();
      const nullCodeMaterials = materials.filter(m => 
        m.materialCode === null || m.materialCode === undefined
      );
      const nullCodeByProject = new Map();
      
      nullCodeMaterials.forEach(m => {
        const projectId = m.projectId?.toString();
        if (!nullCodeByProject.has(projectId)) {
          nullCodeByProject.set(projectId, []);
        }
        nullCodeByProject.get(projectId).push(m._id.toString());
      });
      
      const multipleNullCodes = Array.from(nullCodeByProject.entries())
        .filter(([pid, ids]) => ids.length > 1);
      
      console.log(`\n   Materials with null materialCode: ${nullCodeMaterials.length}`);
      console.log(`   Projects with multiple null materialCode: ${multipleNullCodes.length}`);
      
      if (multipleNullCodes.length > 0 && !materialCodeIndex.sparse) {
        console.log(`\n   ❌ CRITICAL: Index is NOT sparse but has multiple null values!`);
        analysis.issues.push({
          type: 'index_critical',
          severity: 'error',
          message: 'Materials index is not sparse but allows multiple null materialCode values',
          collection: 'materials',
          indexName: materialCodeIndex.name,
          fix: 'Index should be sparse to allow multiple null values',
        });
      } else if (multipleNullCodes.length > 0 && materialCodeIndex.sparse) {
        console.log(`\n   ⚠️  WARNING: Index IS sparse but still getting duplicate key errors!`);
        console.log(`   This suggests the index may not be working correctly.`);
        analysis.issues.push({
          type: 'index_critical',
          severity: 'error',
          message: 'Sparse index exists but duplicate key errors still occur - index may not be active',
          collection: 'materials',
          indexName: materialCodeIndex.name,
          fix: 'Verify index is actually sparse, may need to rebuild index',
        });
      }
    } else {
      console.log(`\n   ❌ No materialCode index found!`);
      analysis.issues.push({
        type: 'index_missing',
        severity: 'error',
        message: 'No unique index on { projectId, materialCode } found',
        collection: 'materials',
      });
    }
    
    // Generate summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    
    const errorCount = analysis.issues.filter(i => i.severity === 'error').length;
    const warningCount = analysis.issues.filter(i => i.severity === 'warning').length;
    
    console.log(`\n   Collections Analyzed: ${Object.keys(analysis.collections).length}`);
    console.log(`   Total Issues Found: ${analysis.issues.length}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Warnings: ${warningCount}`);
    
    // Save analysis to file
    const fs = await import('fs');
    const analysisJson = JSON.stringify(analysis, null, 2);
    fs.writeFileSync(
      join(__dirname, '..', 'MONGODB_COMPREHENSIVE_ANALYSIS.json'),
      analysisJson
    );
    
    console.log(`\n✅ Analysis saved to: MONGODB_COMPREHENSIVE_ANALYSIS.json`);
    
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ Connection closed');
    }
  }
}

comprehensiveAnalysis()
  .then(() => {
    console.log('\n✅ Comprehensive analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });

